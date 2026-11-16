"""ECB euro foreign exchange reference rates, via the free Frankfurter API.

Frankfurter republishes the European Central Bank's daily reference rates unchanged.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

import httpx

from ..models import Source

log = logging.getLogger(__name__)
CURRENCIES = ["EUR", "GBP", "JPY", "CNY", "CHF", "CAD", "INR", "BRL", "MXN", "ZAR", "KRW", "TRY"]


def fetch(as_of: date, source_id: str, topic_ids: list[str], http: httpx.Client | None = None) -> Source | None:
    http = http or httpx.Client(timeout=30)
    start = as_of - timedelta(days=10)
    try:
        r = http.get(
            f"https://api.frankfurter.app/{start.isoformat()}..{as_of.isoformat()}",
            params={"from": "USD", "to": ",".join(CURRENCIES)},
        )
        r.raise_for_status()
        rates: dict[str, dict[str, float]] = r.json()["rates"]
    except Exception as e:
        log.warning("ECB reference rates failed: %s", e)
        return None
    days = sorted(rates)
    if len(days) < 2:
        return None
    last, prev, first = days[-1], days[-2], days[0]
    parts = []
    for cur in CURRENCIES:
        if cur not in rates[last]:
            continue
        v, p, f = rates[last][cur], rates[prev].get(cur), rates[first].get(cur)
        piece = f"1 USD = {v} {cur} on {last}"
        if p:
            piece += f" (vs {p} on {prev}, {((v - p) / p * 100):+.2f}%"
            if f:
                piece += f"; vs {f} on {first}, {((v - f) / f * 100):+.2f}%"
            piece += ")"
        parts.append(piece)
    return Source(
        id=source_id,
        kind="data",
        title="US dollar cross rates calculated from ECB euro reference rates",
        publisher="European Central Bank (via Frankfurter)",
        url="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
        published=last,
        text=". ".join(parts) + ". A higher number means the dollar buys more of that currency.",
        topic_ids=topic_ids,
    )
