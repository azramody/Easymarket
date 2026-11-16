"""Official economic and market data from FRED (Federal Reserve Bank of St. Louis).

Only values returned by the API end up in a Source; nothing is estimated.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta

import httpx

from ..models import Source

log = logging.getLogger(__name__)
BASE = "https://api.stlouisfed.org/fred"


@dataclass
class SeriesSnapshot:
    series_id: str
    title: str
    units: str
    frequency: str
    last_updated: str
    observations: list[tuple[str, float]]  # newest first

    @property
    def latest(self) -> tuple[str, float] | None:
        return self.observations[0] if self.observations else None

    def value_on_or_before(self, target: date) -> tuple[str, float] | None:
        for d, v in self.observations:
            if date.fromisoformat(d) <= target:
                return d, v
        return None


def _fmt(v: float) -> str:
    """Format a value without inventing precision FRED did not report."""
    if abs(v) >= 1000:
        return f"{v:,.2f}"
    if abs(v) >= 1:
        return f"{v:.2f}"
    return f"{v:.4f}"


def _pct(a: float, b: float) -> str:
    if b == 0:
        return "n/a"
    return f"{(a - b) / abs(b) * 100:+.2f}%"


class FredClient:
    def __init__(self, api_key: str, http: httpx.Client | None = None):
        self.api_key = api_key
        self.http = http or httpx.Client(timeout=30)
        self._cache: dict[str, SeriesSnapshot | None] = {}

    def _get(self, path: str, **params) -> dict:
        params.update(api_key=self.api_key, file_type="json")
        for attempt in range(3):
            r = self.http.get(f"{BASE}/{path}", params=params)
            if r.status_code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
            return r.json()
        r.raise_for_status()
        return {}

    def series(self, series_id: str) -> SeriesSnapshot | None:
        if series_id in self._cache:
            return self._cache[series_id]
        try:
            meta = self._get("series", series_id=series_id)["seriess"][0]
            obs = self._get(
                "series/observations",
                series_id=series_id,
                sort_order="desc",
                limit=400,
                observation_start=(date.today() - timedelta(days=800)).isoformat(),
            )["observations"]
            values = [(o["date"], float(o["value"])) for o in obs if o["value"] not in (".", "")]
            snap = SeriesSnapshot(
                series_id=series_id,
                title=meta["title"],
                units=meta.get("units_short") or meta.get("units", ""),
                frequency=meta.get("frequency_short") or meta.get("frequency", ""),
                last_updated=meta.get("last_updated", ""),
                observations=values,
            )
        except Exception as e:  # one bad series must not sink the episode
            log.warning("FRED %s failed: %s", series_id, e)
            snap = None
        self._cache[series_id] = snap
        time.sleep(0.25)  # stay well inside FRED's 120 requests/minute
        return snap

    def upcoming_releases(self, start: date, days: int = 7) -> list[dict]:
        try:
            data = self._get(
                "releases/dates",
                realtime_start=start.isoformat(),
                realtime_end=(start + timedelta(days=days)).isoformat(),
                include_release_dates_with_no_data="true",
                sort_order="asc",
                limit=200,
            )
            return data.get("release_dates", [])
        except Exception as e:
            log.warning("FRED release calendar failed: %s", e)
            return []


def describe(snap: SeriesSnapshot, as_of: date) -> str:
    """Turn a series into a short, factual block of text using only API values."""
    latest = snap.latest
    if not latest:
        return ""
    d0, v0 = latest
    lines = [f"Latest value: {_fmt(v0)} {snap.units} (observation date {d0})."]
    freq = snap.frequency.lower()
    comparisons: list[tuple[str, int]]
    if freq.startswith("d") or freq.startswith("w"):
        comparisons = [("previous observation", 0), ("about 1 week earlier", 7), ("about 1 month earlier", 30), ("about 1 year earlier", 365)]
    else:
        comparisons = [("previous observation", 0), ("about 1 year earlier", 365)]
    latest_date = date.fromisoformat(d0)
    for label, days in comparisons:
        if days == 0:
            prev = snap.observations[1] if len(snap.observations) > 1 else None
        else:
            prev = snap.value_on_or_before(latest_date - timedelta(days=days))
        if prev:
            pd_, pv = prev
            diff = v0 - pv
            unit = snap.units
            change = f"change {diff:+.2f} {unit}" if "percent" in unit.lower() or unit.strip() in ("%",) else f"change {_pct(v0, pv)}"
            lines.append(f"{label.capitalize()}: {_fmt(pv)} {snap.units} ({pd_}); {change}.")
    lines.append(f"Series frequency: {snap.frequency}. FRED last updated: {snap.last_updated}.")
    return " ".join(lines)


def is_fresh_release(snap: SeriesSnapshot, as_of: date, window_days: int) -> bool:
    """True when FRED updated the series inside the lookback window (a new data report).

    FRED formats last_updated like "2026-11-14 07:51:03-06"; the date part is enough.
    """
    try:
        updated = date.fromisoformat(snap.last_updated[:10])
    except ValueError:
        return False
    return 0 <= (as_of - updated).days <= window_days


def to_source(snap: SeriesSnapshot, as_of: date, source_id: str, topic_ids: list[str], fresh: bool) -> Source:
    title = snap.title + (" — NEW DATA RELEASE" if fresh else "")
    return Source(
        id=source_id,
        kind="data",
        title=title,
        publisher="FRED, Federal Reserve Bank of St. Louis",
        url=f"https://fred.stlouisfed.org/series/{snap.series_id}",
        published=snap.latest[0] if snap.latest else as_of.isoformat(),
        text=describe(snap, as_of),
        topic_ids=topic_ids,
    )
