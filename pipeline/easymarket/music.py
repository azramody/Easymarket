"""Intro, transition and outro music.

By default the pipeline synthesises short, soft cues itself, so there is nothing to
license. To use your own royalty-free tracks instead, drop intro.wav / transition.wav /
outro.wav (24 kHz or any rate; mono or stereo) into pipeline/assets/music/.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .tts import SAMPLE_RATE

SR = SAMPLE_RATE


def _note(freq: float, dur: float, amp: float, attack: float = 0.02, release: float = 0.6) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    # Soft electric-piano-ish tone: fundamental + a couple of gentle harmonics.
    wave = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.12 * np.sin(6 * np.pi * freq * t)
    env = np.minimum(1, t / attack) * np.exp(-t / release)
    return (amp * wave * env).astype(np.float32)


def _pad(freqs: list[float], dur: float, amp: float) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    wave = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate(freqs)) / len(freqs)
    env = np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 1.2).clip(0, 1)
    return (amp * wave * env).astype(np.float32)


def _place(buf: np.ndarray, clip: np.ndarray, at: float) -> None:
    i = int(at * SR)
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i]


def _hz(midi: int) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def synth_intro() -> np.ndarray:
    dur = 6.0
    buf = np.zeros(int(SR * dur), dtype=np.float32)
    _place(buf, _pad([_hz(m) for m in (60, 64, 67, 71)], dur, 0.10), 0)  # Cmaj7 pad
    for k, m in enumerate([72, 76, 79, 83, 81, 79]):
        _place(buf, _note(_hz(m), 1.6, 0.12), 0.4 + k * 0.42)
    return buf


def synth_transition() -> np.ndarray:
    dur = 2.4
    buf = np.zeros(int(SR * dur), dtype=np.float32)
    _place(buf, _pad([_hz(m) for m in (65, 69, 72, 76)], dur, 0.07), 0)  # Fmaj7 pad
    for k, m in enumerate([77, 81, 84]):
        _place(buf, _note(_hz(m), 1.4, 0.11), 0.15 + k * 0.22)
    return buf


def synth_outro() -> np.ndarray:
    dur = 6.5
    buf = np.zeros(int(SR * dur), dtype=np.float32)
    _place(buf, _pad([_hz(m) for m in (57, 60, 64, 67)], 3.2, 0.09), 0)  # Am7
    _place(buf, _pad([_hz(m) for m in (60, 64, 67, 71)], 3.4, 0.09), 3.1)  # Cmaj7
    for k, m in enumerate([76, 74, 72, 71, 72]):
        _place(buf, _note(_hz(m), 1.8, 0.11), 0.3 + k * 0.55)
    _place(buf, _note(_hz(84), 3.0, 0.10, release=1.2), 3.3)
    return buf


def _load(path: Path) -> np.ndarray | None:
    if not path.exists():
        return None
    import soundfile as sf

    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if sr != SR:
        idx = np.linspace(0, len(mono) - 1, int(len(mono) * SR / sr))
        mono = np.interp(idx, np.arange(len(mono)), mono).astype(np.float32)
    return mono


def cues(music_dir: Path) -> dict[str, np.ndarray]:
    return {
        "intro": _load(music_dir / "intro.wav") if (music_dir / "intro.wav").exists() else synth_intro(),
        "transition": _load(music_dir / "transition.wav") if (music_dir / "transition.wav").exists() else synth_transition(),
        "outro": _load(music_dir / "outro.wav") if (music_dir / "outro.wav").exists() else synth_outro(),
    }
