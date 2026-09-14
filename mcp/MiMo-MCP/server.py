"""A minimal stdio MCP server that gives a text model access to MiMo vision."""

from __future__ import annotations

import base64
import json
import mimetypes
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from mcp.server.mcpserver import MCPServer

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_BASE_URL = "https://api.xiaomimimo.com/v1/chat/completions"
DEFAULT_MODEL = "mimo-v2.5"
MAX_IMAGE_BYTES = 20 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

load_dotenv(PROJECT_ROOT / ".env")

mcp = MCPServer("mimo-vision")


def resolve_image_path(image_path: str) -> Path:
    """Resolve a local image while preventing reads outside this project."""
    supplied_path = Path(image_path).expanduser()
    candidate = (
        supplied_path if supplied_path.is_absolute() else PROJECT_ROOT / supplied_path
    )
    # Resolve lexically first so an outside path is rejected consistently even
    # when that file does not exist.
    resolved_path = candidate.resolve()

    try:
        resolved_path.relative_to(PROJECT_ROOT)
    except ValueError as error:
        raise ValueError(
            "image_path must be inside the MiMo-MCP project directory"
        ) from error

    if not resolved_path.is_file():
        raise ValueError("image_path must refer to an existing file")

    return resolved_path


def image_to_data_url(image_path: Path) -> str:
    """Convert a local, supported image into the data URL accepted by MiMo."""
    mime_type, _ = mimetypes.guess_type(image_path.name)
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise ValueError("Supported image formats are JPEG, PNG, and WebP")

    image_bytes = image_path.read_bytes()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 20 MiB prototype limit")

    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded_image}"


def build_mimo_request(*, image_data_url: str, question: str) -> dict[str, object]:
    """Build the OpenAI-compatible multimodal Chat Completions payload."""
    return {
        "model": os.environ.get("MIMO_MODEL", DEFAULT_MODEL),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a precise visual analyst. Describe only what is visible "
                    "and state uncertainty explicitly."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
        "max_completion_tokens": 1024,
        "temperature": 0.2,
        "stream": False,
        "thinking": {"type": "disabled"},
    }


def call_mimo(payload: dict[str, object]) -> tuple[str, str]:
    """Send one multimodal request to MiMo and return its model id and text answer."""
    api_key = os.environ.get("XIAOMI_API_KEY")
    if not api_key:
        raise RuntimeError("XIAOMI_API_KEY is missing from .env")

    request = Request(
        os.environ.get("MIMO_BASE_URL", DEFAULT_BASE_URL),
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=90) as response:
            response_data = json.load(response)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"MiMo API returned HTTP {error.code}: {body}") from error
    except URLError as error:
        raise RuntimeError(f"MiMo API could not be reached: {error.reason}") from error

    try:
        content = response_data["choices"][0]["message"]["content"]
    except (IndexError, KeyError, TypeError) as error:
        raise RuntimeError("MiMo API returned an unexpected response format") from error

    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("MiMo API returned no text content")

    model = response_data.get("model", payload["model"])
    return str(model), content.strip()


def analyze_local_image(image_path: str, question: str) -> dict[str, str]:
    """Run the vision request, separate from MCP for direct testing."""
    resolved_path = resolve_image_path(image_path)
    payload = build_mimo_request(
        image_data_url=image_to_data_url(resolved_path), question=question
    )
    model, answer = call_mimo(payload)
    return {
        "image": resolved_path.name,
        "model": model,
        "analysis": answer,
    }


@mcp.tool(
    title="Analyze a local image with MiMo",
    description=(
        "Use MiMo-V2.5 on a JPEG, PNG, or WebP inside the MiMo-MCP project. "
        "Returns text suitable for a text-only model to reason over."
    ),
)
def analyze_image(
    image_path: str, question: str = "Describe this image in detail."
) -> dict[str, str]:
    """Return a textual visual observation, never raw image bytes."""
    return analyze_local_image(image_path, question)


if __name__ == "__main__":
    # stdio is reserved for JSON-RPC. Do not print diagnostic text to stdout.
    mcp.run(transport="stdio")
