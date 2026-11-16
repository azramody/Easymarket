"""Thin wrapper around the Gemini API so the rest of the code (and tests) don't care
which model or SDK version is in use."""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Protocol

log = logging.getLogger(__name__)


class LLM(Protocol):
    def generate_json(self, system: str, prompt: str) -> dict: ...


def parse_json(text: str) -> dict:
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1)
    return json.loads(text)


class GeminiLLM:
    def __init__(self, api_key: str, model: str):
        from google import genai  # imported lazily so tests don't need credentials

        self.client = genai.Client(api_key=api_key)
        self.model = model

    def generate_json(self, system: str, prompt: str) -> dict:
        from google.genai import types

        last_err: Exception | None = None
        for attempt in range(4):
            try:
                resp = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        response_mime_type="application/json",
                        temperature=0.4,
                    ),
                )
                return parse_json(resp.text or "")
            except Exception as e:  # rate limits on the free tier are common; back off
                last_err = e
                wait = 20 * (attempt + 1)
                log.warning("Gemini call failed (%s); retrying in %ss", e, wait)
                time.sleep(wait)
        raise RuntimeError(f"Gemini failed after retries: {last_err}")
