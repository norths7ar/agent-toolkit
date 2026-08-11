"""Directly test a local Ollama vision model against one image."""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from urllib.request import Request, urlopen

DEFAULT_MODEL = "qwen3-vl:8b"
DEFAULT_QUESTION = "请用中文描述图片内容，并指出其中所有可见文字。"


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe a local Ollama vision model")
    parser.add_argument("image_path", type=Path)
    parser.add_argument("--question", default=DEFAULT_QUESTION)
    parser.add_argument("--keep-alive", default=0)
    args = parser.parse_args()

    image_path = args.image_path.resolve()
    if not image_path.is_file():
        raise SystemExit(f"Image does not exist: {image_path}")

    payload = {
        "model": DEFAULT_MODEL,
        "stream": False,
        "think": False,
        "keep_alive": args.keep_alive,
        "messages": [
            {
                "role": "user",
                "content": args.question,
                "images": [base64.b64encode(image_path.read_bytes()).decode("ascii")],
            }
        ],
    }
    request = Request(
        "http://127.0.0.1:11434/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=180) as response:
        result = json.load(response)

    message = result["message"]
    print(
        json.dumps(
            {
                "image": image_path.name,
                "model": result["model"],
                "answer": message["content"].strip(),
                "thinking_chars": len(message.get("thinking") or ""),
                "total_duration_s": round(result["total_duration"] / 1_000_000_000, 2),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
