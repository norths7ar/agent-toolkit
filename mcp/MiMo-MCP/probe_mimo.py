"""Call the MiMo vision function directly, without MCP transport."""

from __future__ import annotations

import argparse
import json

from server import analyze_local_image


def main() -> None:
    parser = argparse.ArgumentParser(description="Direct MiMo vision probe")
    parser.add_argument(
        "image_path", help="Project-relative path to a JPEG, PNG, or WebP image"
    )
    parser.add_argument("--question", default="Describe this image in detail.")
    args = parser.parse_args()

    print(
        json.dumps(
            analyze_local_image(args.image_path, args.question),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
