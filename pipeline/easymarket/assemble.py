"""Stitch voice and music into one MP3 and record where each chapter starts."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .tts import SAMPLE_RATE

SR = SAMPLE_RATE


def _normalize(x: np.ndarray, target_rms: float) -> np.ndarray:
    if x.size == 0:
        return x
    rms = float(np.sqrt(np.mean(x ** 2))) or 1.0
    y = x * (target_rms / rms)
    peak = float(np.max(np.abs(y))) or 1.0
    return (y / peak * 0.95 if peak > 0.95 else y).astype(np.float32)


def _silence(sec: float) -> np.ndarray:
    return np.zeros(int(SR * sec), dtype=np.float32)


def build(parts: list[tuple[str, str, np.ndarray]]) -> tuple[np.ndarray, list[dict]]:
    """parts: (kind, chapter_id, audio). kind is 'voice' or 'music'.

    Returns the full waveform and chapters [{id, start}] for voice parts.
    """
    out: list[np.ndarray] = []
    chapters: list[dict] = []
    pos = 0
    for kind, chapter_id, audio in parts:
        clip = _normalize(audio, 0.08 if kind == "voice" else 0.05)
        if kind == "voice":
            chapters.append({"id": chapter_id, "start": round(pos / SR, 2)})
        out.append(clip)
        pos += len(clip)
        gap = _silence(0.35)
        out.append(gap)
        pos += len(gap)
    return (np.concatenate(out) if out else np.zeros(0, np.float32)), chapters


def to_mp3(audio: np.ndarray, dest: Path, bitrate: str = "48k") -> float:
    """Encode with ffmpeg. Returns duration in seconds."""
    import soundfile as sf

    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "episode.wav"
        sf.write(str(wav), audio, SR, subtype="PCM_16")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-codec:a", "libmp3lame", "-b:a", bitrate, str(dest)],
            check=True,
        )
    return round(len(audio) / SR, 2)
