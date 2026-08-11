"""A stdio MCP server for private local image analysis through Ollama."""

from __future__ import annotations

import base64
import json
import mimetypes
import os
from collections.abc import Mapping
from pathlib import Path
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from mcp.server.mcpserver import MCPServer

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen3-vl:8b"
REQUEST_TIMEOUT_SECONDS = 180
MAX_IMAGE_BYTES = 20 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

mcp = MCPServer("local-vision")


def resolve_image_path(image_path: str) -> Path:
    """Resolve an arbitrary local image path without uploading it externally."""
    supplied_path = Path(image_path).expanduser()
    candidate = (
        supplied_path if supplied_path.is_absolute() else PROJECT_ROOT / supplied_path
    )
    resolved_path = candidate.resolve()
    if not resolved_path.is_file():
        raise ValueError("image_path must refer to an existing file")
    return resolved_path


def image_to_base64(image_path: Path) -> str:
    """Read a bounded, supported image into the base64 shape Ollama accepts."""
    mime_type, _ = mimetypes.guess_type(image_path.name)
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise ValueError("Supported image formats are JPEG, PNG, and WebP")

    image_bytes = image_path.read_bytes()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 20 MiB local tool limit")
    return base64.b64encode(image_bytes).decode("ascii")


def build_ollama_payload(*, image_base64: str, question: str) -> dict[str, object]:
    """Build one private Ollama Chat request for visual analysis."""
    if not question.strip():
        raise ValueError("question must not be blank")

    return {
        "model": os.environ.get("OLLAMA_VISION_MODEL", DEFAULT_MODEL),
        "stream": False,
        "think": False,
        "keep_alive": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Analyze the supplied image carefully. "
                    "State visible evidence only. "
                    "Mark uncertainty and do not invent small details."
                ),
            },
            {"role": "user", "content": question, "images": [image_base64]},
        ],
    }


def ollama_chat_url() -> str:
    """Return the local Ollama endpoint, with an override for controlled testing."""
    base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/")
    return f"{base_url}/api/chat"


def extract_analysis(response_data: Mapping[str, object]) -> tuple[str, int]:
    """Read final content while intentionally discarding separate reasoning text."""
    message = response_data.get("message")
    if not isinstance(message, Mapping):
        raise RuntimeError("Ollama returned an unexpected response: missing message")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Ollama returned an unexpected response: missing content")

    thinking = message.get("thinking")
    thinking_chars = len(thinking) if isinstance(thinking, str) else 0
    return content.strip(), thinking_chars


def call_ollama(payload: dict[str, object]) -> tuple[str, str, int, int]:
    """Call local Ollama and return model, final analysis, latency, and thought size."""
    request = Request(
        ollama_chat_url(),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = perf_counter()
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            response_data = json.load(response)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Ollama returned HTTP {error.code}: {body}") from error
    except URLError as error:
        raise RuntimeError(
            "Could not reach local Ollama at "
            f"{ollama_chat_url()}. Start the Ollama desktop app or run `ollama serve`. "
            f"Details: {error.reason}"
        ) from error

    if not isinstance(response_data, Mapping):
        raise RuntimeError("Ollama returned an unexpected non-object response")

    analysis, thinking_chars = extract_analysis(response_data)
    elapsed_ms = round((perf_counter() - started) * 1000)
    model = str(response_data.get("model", payload["model"]))
    return model, analysis, elapsed_ms, thinking_chars


def analyze_with_ollama(image_path: str, question: str) -> dict[str, object]:
    """Analyze one local image, keeping raw bytes inside the local machine."""
    resolved_path = resolve_image_path(image_path)
    payload = build_ollama_payload(
        image_base64=image_to_base64(resolved_path), question=question
    )
    model, analysis, elapsed_ms, thinking_chars = call_ollama(payload)
    return {
        "image": str(resolved_path),
        "model": model,
        "analysis": analysis,
        "elapsed_ms": elapsed_ms,
        "thinking_chars_discarded": thinking_chars,
    }


@mcp.tool(
    title="Analyze a local image privately with Ollama",
    description=(
        "Use local Qwen3-VL to analyze a specified JPEG, PNG, or WebP image. Use "
        "for private, low-cost visual description and ordinary OCR. Image bytes are "
        "sent only to local Ollama at http://127.0.0.1:11434. Use MiMo instead when "
        "fine visual detail or high-confidence OCR is required."
    ),
)
def analyze_image(
    image_path: str, question: str = "Describe this image and list any visible text."
) -> dict[str, object]:
    """Return local model observations for an arbitrary specified image path."""
    return analyze_with_ollama(image_path, question)


if __name__ == "__main__":
    mcp.run(transport="stdio")
