"""A stdio MCP server for private, local text translation through Ollama."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from mcp.server.mcpserver import MCPServer

DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen3:4b-translate"
DEFAULT_KEEP_ALIVE = "2m"
REQUEST_TIMEOUT_SECONDS = 120
MAX_TEXT_CHARACTERS = 20_000

mcp = MCPServer("local-translate")


def normalize_label(value: str, *, field_name: str) -> str:
    """Validate a short language label before placing it in the prompt."""
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be blank")
    if len(normalized) > 80:
        raise ValueError(f"{field_name} must be at most 80 characters")
    return normalized


def build_translation_payload(
    *, text: str, source_language: str, target_language: str
) -> dict[str, object]:
    """Build an Ollama Chat API request that returns translation only."""
    if not text.strip():
        raise ValueError("text must not be blank")
    if len(text) > MAX_TEXT_CHARACTERS:
        raise ValueError(
            f"text exceeds the {MAX_TEXT_CHARACTERS:,}-character local tool limit"
        )

    source = normalize_label(source_language, field_name="source_language")
    target = normalize_label(target_language, field_name="target_language")
    model = os.environ.get("OLLAMA_TRANSLATE_MODEL", DEFAULT_MODEL)
    keep_alive = (
        os.environ.get("LOCAL_TRANSLATE_KEEP_ALIVE", DEFAULT_KEEP_ALIVE).strip()
        or DEFAULT_KEEP_ALIVE
    )

    return {
        "model": model,
        "stream": False,
        # Keep the model warm briefly for related requests, then let Ollama release it.
        "keep_alive": keep_alive,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a professional translation engine. Translate from "
                    f"{source} to {target}. Preserve meaning, tone, formatting, "
                    "and technical terminology. Return only the translation, with "
                    "no commentary, notes, analysis, or Markdown code fences."
                ),
            },
            {"role": "user", "content": text},
        ],
    }


def strip_thinking(content: str) -> str:
    """Defensively remove a Qwen thinking block if a runtime ever emits one."""
    if "</think>" in content:
        content = content.rsplit("</think>", maxsplit=1)[1]
    return content.strip()


def extract_translation(response_data: Mapping[str, object]) -> str:
    """Read Ollama's Chat API response and guarantee non-empty final text."""
    message = response_data.get("message")
    if not isinstance(message, Mapping):
        raise RuntimeError("Ollama returned an unexpected response: missing message")

    content = message.get("content")
    if not isinstance(content, str):
        raise RuntimeError("Ollama returned an unexpected response: missing content")

    translation = strip_thinking(content)
    if not translation:
        raise RuntimeError("Ollama returned no translation text")
    return translation


def ollama_chat_url() -> str:
    """Return the local Ollama chat endpoint, optionally overridden for testing."""
    base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/")
    return f"{base_url}/api/chat"


def call_ollama(payload: dict[str, object]) -> tuple[str, str, int]:
    """Call the local Ollama Chat API and return model, translation, and latency."""
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

    model = response_data.get("model", payload["model"])
    elapsed_ms = round((perf_counter() - started) * 1000)
    return str(model), extract_translation(response_data), elapsed_ms


def translate_with_ollama(
    text: str, source_language: str = "Chinese", target_language: str = "English"
) -> dict[str, object]:
    """Translate text via local Ollama, kept separate for direct testing."""
    payload = build_translation_payload(
        text=text,
        source_language=source_language,
        target_language=target_language,
    )
    model, translation, elapsed_ms = call_ollama(payload)
    return {
        "translation": translation,
        "source_language": normalize_label(
            source_language, field_name="source_language"
        ),
        "target_language": normalize_label(
            target_language, field_name="target_language"
        ),
        "model": model,
        "elapsed_ms": elapsed_ms,
    }


@mcp.tool(
    title="Translate text locally with Ollama",
    description=(
        "Translate text using the local qwen3:4b-translate Ollama model. "
        "Use for short to medium text when local-only translation is preferable. "
        "The tool sends text only to http://127.0.0.1:11434."
    ),
)
def translate_text(
    text: str,
    source_language: str = "Chinese",
    target_language: str = "English",
) -> dict[str, object]:
    """Translate text locally and return only the final translation plus metadata."""
    return translate_with_ollama(text, source_language, target_language)


if __name__ == "__main__":
    # stdio is reserved for JSON-RPC: never print diagnostics to stdout.
    mcp.run(transport="stdio")
