"""Offline tests for local image validation and Ollama response handling."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server import (
    MAX_IMAGE_BYTES,
    build_ollama_payload,
    extract_analysis,
    image_to_base64,
    resolve_image_path,
)


class ServerTests(unittest.TestCase):
    def test_absolute_image_path_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "sample.png"
            image_path.write_bytes(b"png")
            self.assertEqual(resolve_image_path(str(image_path)), image_path.resolve())

    def test_missing_image_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "existing file"):
            resolve_image_path("C:\\definitely-missing-image.jpg")

    def test_supported_image_is_encoded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "sample.jpg"
            image_path.write_bytes(b"image-bytes")
            self.assertTrue(image_to_base64(image_path))

    def test_unsupported_image_type_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "sample.gif"
            image_path.write_bytes(b"gif")
            with self.assertRaisesRegex(ValueError, "Supported image formats"):
                image_to_base64(image_path)

    def test_oversized_image_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "sample.png"
            image_path.write_bytes(b"x" * (MAX_IMAGE_BYTES + 1))
            with self.assertRaisesRegex(ValueError, "20 MiB"):
                image_to_base64(image_path)

    def test_payload_keeps_image_local_to_ollama(self) -> None:
        payload = build_ollama_payload(image_base64="abc", question="What is shown?")
        self.assertEqual(payload["model"], "qwen3-vl:8b")
        self.assertEqual(payload["keep_alive"], "5m")
        self.assertEqual(payload["messages"][1]["images"], ["abc"])

    def test_response_discards_thinking_text(self) -> None:
        response = {"message": {"content": "Final answer", "thinking": "internal"}}
        self.assertEqual(extract_analysis(response), ("Final answer", len("internal")))

    def test_keep_alive_can_be_configured_per_mcp(self) -> None:
        with patch.dict("os.environ", {"LOCAL_VISION_KEEP_ALIVE": "10m"}):
            payload = build_ollama_payload(
                image_base64="abc", question="What is shown?"
            )
        self.assertEqual(payload["keep_alive"], "10m")


if __name__ == "__main__":
    unittest.main()
