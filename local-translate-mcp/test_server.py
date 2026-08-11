"""Offline tests for the Ollama request and response boundary."""

from __future__ import annotations

import unittest

from server import (
    MAX_TEXT_CHARACTERS,
    build_translation_payload,
    extract_translation,
    normalize_label,
)


class ServerTests(unittest.TestCase):
    def test_payload_targets_local_translation_model(self) -> None:
        payload = build_translation_payload(
            text="本地模型已经可以工作了。",
            source_language="Chinese",
            target_language="English",
        )

        self.assertEqual(payload["model"], "qwen3:4b-translate")
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["keep_alive"], 0)
        self.assertEqual(payload["messages"][1]["content"], "本地模型已经可以工作了。")

    def test_blank_text_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "must not be blank"):
            build_translation_payload(
                text="  ", source_language="Chinese", target_language="English"
            )

    def test_oversized_text_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "character local tool limit"):
            build_translation_payload(
                text="x" * (MAX_TEXT_CHARACTERS + 1),
                source_language="Chinese",
                target_language="English",
            )

    def test_thinking_block_is_removed_from_response(self) -> None:
        response = {
            "message": {
                "content": "internal reasoning</think>\nThe local model is working."
            }
        }
        self.assertEqual(extract_translation(response), "The local model is working.")

    def test_missing_content_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "missing content"):
            extract_translation({"message": {}})

    def test_language_label_is_short_and_nonempty(self) -> None:
        self.assertEqual(
            normalize_label(" English ", field_name="target_language"),
            "English",
        )
        with self.assertRaises(ValueError):
            normalize_label("", field_name="target_language")


if __name__ == "__main__":
    unittest.main()
