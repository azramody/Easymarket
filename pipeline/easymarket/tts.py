"""Text-to-speech with Kokoro (open-source, Apache-2.0), run locally on CPU."""
from __future__ import annotations

import logging
import re

import numpy as np

log = logging.getLogger(__name__)
SAMPLE_RATE = 24000

# English Kokoro voices offered in the app. First letter: a = American, b = British.
VOICES = {
    "af_heart": "Heart (American, warm)",
    "af_bella": "Bella (American, bright)",
    "am_michael": "Michael (American, calm)",
    "bf_emma": "Emma (British)",
    "bm_george": "George (British)",
}
DEFAULT_VOICE = "af_heart"


def normalize_for_speech(text: str) -> str:
    t = text
    t = re.sub(r"\$(\d[\d,]*(?:\.\d+)?)(\s*(?:trillion|billion|million|thousand))?", r"\1\2 dollars", t)
    t = re.sub(r"(\d)\s*%", r"\1 percent", t)
    t = re.sub(r"(?<![\w.])\+(?=\d)", "plus ", t)
    t = re.sub(r"(?<![\w.])[-−](?=\d)", "minus ", t)
    t = re.sub(r"(\d)\s*bps?\b", r"\1 basis points", t)
    t = re.sub(r"\bS&P\b", "S and P", t)
    t = re.sub(r"\bvs\.?\b", "versus", t)
    t = re.sub(r"\bQ([1-4])\b", lambda m: ["first", "second", "third", "fourth"][int(m.group(1)) - 1] + " quarter", t)
    t = re.sub(r"(\d),(\d{3})", r"\1\2", t)  # 1,234 -> 1234 reads more reliably
    t = t.replace("&", " and ")
    t = re.sub(r"[*_#`]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def chunk(text: str, max_chars: int = 350) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks, cur = [], ""
    for s in sentences:
        if len(cur) + len(s) + 1 > max_chars and cur:
            chunks.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        chunks.append(cur)
    return chunks


class KokoroTTS:
    def __init__(self, model_path: str, voices_path: str):
        from kokoro_onnx import Kokoro

        self.k = Kokoro(model_path, voices_path)

    def speak(self, text: str, voice: str = DEFAULT_VOICE, speed: float = 1.0) -> np.ndarray:
        if voice not in VOICES:
            voice = DEFAULT_VOICE
        lang = "en-gb" if voice.startswith("b") else "en-us"
        pieces = []
        gap = np.zeros(int(SAMPLE_RATE * 0.18), dtype=np.float32)
        for c in chunk(normalize_for_speech(text)):
            samples, sr = self.k.create(c, voice=voice, speed=speed, lang=lang)
            if sr != SAMPLE_RATE:
                raise ValueError(f"unexpected sample rate {sr}")
            pieces.extend([samples.astype(np.float32), gap])
        return np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)


class DummyTTS:
    """Stand-in for tests and offline runs: a soft tone whose length tracks the text."""

    def speak(self, text: str, voice: str = DEFAULT_VOICE, speed: float = 1.0) -> np.ndarray:
        words = len(normalize_for_speech(text).split())
        seconds = max(0.5, words / 2.5 / speed)
        t = np.arange(int(SAMPLE_RATE * seconds)) / SAMPLE_RATE
        return (0.05 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def make_tts(engine: str, model_path: str, voices_path: str):
    if engine == "dummy":
        return DummyTTS()
    return KokoroTTS(model_path, voices_path)
