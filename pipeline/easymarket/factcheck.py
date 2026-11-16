"""Guardrail: every number spoken in an episode must appear in a cited source.

Scripts are asked to write numbers as digits so they can be checked here. A number
counts as verified when a cited source contains the same value at the precision the
script used (so 4.2 matches a source's 4.237), or the same value expressed in basis
points, or it is a calendar year / small count / day of the month next to a month name.
"""
from __future__ import annotations

import re

NUM = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?")
MONTHS = ("january", "february", "march", "april", "may", "june", "july", "august", "september",
          "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep",
          "sept", "oct", "nov", "dec")
SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _numbers(text: str) -> list[tuple[str, float, int]]:
    out = []
    for m in NUM.finditer(text):
        raw = m.group(0).replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        out.append((m.group(0), val, decimals))
    return out


def _source_values(texts: list[str]) -> list[float]:
    vals = []
    for t in texts:
        for _, v, _ in _numbers(t):
            vals.append(v)
            vals.append(abs(v))
    return vals


def _near_month(text: str, token: str) -> bool:
    for m in re.finditer(re.escape(token), text):
        window = text[max(0, m.start() - 12): m.end() + 12].lower()
        if any(re.search(rf"\b{mo}\b", window) for mo in MONTHS):
            return True
    return False


def unverified_numbers(script: str, source_texts: list[str]) -> list[str]:
    values = _source_values(source_texts)
    bad = []
    for token, val, dec in _numbers(script):
        a = abs(val)
        if dec == 0 and 1900 <= a <= 2100:
            continue  # a year
        if dec == 0 and a <= 10:
            continue  # small counts ("two reasons", "10-year")
        if dec == 0 and a in (30, 52) :
            continue  # "30-year" mortgage/bond, "52-week"
        if dec == 0 and a <= 31 and _near_month(script, token):
            continue  # a date
        tol = 0.5 * 10 ** (-dec) + 1e-9
        if any(abs(a - abs(s)) <= tol for s in values):
            continue
        if dec == 0 and any(abs(a - abs(s) * 100) <= 0.5 for s in values):
            continue  # basis points: 0.25 percentage points -> 25 basis points
        bad.append(token)
    return bad


def strip_unverified(script: str, source_texts: list[str]) -> tuple[str, list[str]]:
    """Last-resort fix: drop sentences that still contain unverified numbers."""
    kept, dropped = [], []
    for sentence in SENTENCE.split(script):
        if unverified_numbers(sentence, source_texts):
            dropped.append(sentence)
        else:
            kept.append(sentence)
    return " ".join(kept).strip(), dropped
