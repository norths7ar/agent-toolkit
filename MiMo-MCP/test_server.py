"""Offline checks for the local file boundary and MiMo payload construction."""

from __future__ import annotations

import unittest

from server import (
    PROJECT_ROOT,
    build_mimo_request,
    image_to_data_url,
    resolve_image_path,
)


class ServerTests(unittest.TestCase):
    def test_project_image_is_accepted(self) -> None:
        image_path = resolve_image_path("test_image1.jpg")
        self.assertEqual(image_path, PROJECT_ROOT / "test_image1.jpg")

    def test_path_outside_project_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            resolve_image_path("..\\outside.jpg")

    def test_jpeg_is_encoded_as_data_url(self) -> None:
        data_url = image_to_data_url(PROJECT_ROOT / "test_image1.jpg")
        self.assertTrue(data_url.startswith("data:image/jpeg;base64,"))

    def test_payload_has_text_and_image_content(self) -> None:
        payload = build_mimo_request(
            image_data_url="data:image/jpeg;base64,abc", question="What is shown?"
        )
        content = payload["messages"][1]["content"]
        self.assertEqual(content[0]["type"], "text")
        self.assertEqual(content[1]["type"], "image_url")


if __name__ == "__main__":
    unittest.main()
