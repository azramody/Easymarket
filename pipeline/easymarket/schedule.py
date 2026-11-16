"""Decide which topics are due on a given date and how long the episode should be."""
from __future__ import annotations

from datetime import date

from . import config
from .models import TopicPref


def is_due(pref: TopicPref, day: date) -> bool:
    if not pref.enabled:
        return False
    weekday = day.weekday()  # Monday = 0
    if pref.frequency == "daily":
        return True
    if pref.frequency == "weekdays":
        return weekday < 5
    if pref.frequency == "weekly":
        return weekday == pref.weekly_day
    return False


def due_topics(prefs: list[TopicPref], day: date) -> list[TopicPref]:
    return [p for p in prefs if is_due(p, day)]


def episode_kind(due: list[TopicPref]) -> str:
    """Any weekly topic on the day turns it into the longer, combined episode."""
    return "extended" if any(p.frequency == "weekly" for p in due) else "daily"


def word_budget(due: list[TopicPref]) -> tuple[int, dict[str, int]]:
    """Total spoken words and a per-topic split.

    Weekly topics get three times the share of a daily topic, because they cover a
    whole week of news in one go.
    """
    kind = episode_kind(due)
    minutes = config.EXTENDED_MINUTES if kind == "extended" else config.DAILY_MINUTES
    total = minutes * config.WORDS_PER_MINUTE
    # Intro, transitions and outro take roughly 12% of the time.
    body = int(total * 0.88)
    weights = {p.topic_id: (3 if p.frequency == "weekly" else 1) for p in due}
    weight_sum = sum(weights.values()) or 1
    per_topic = {tid: max(80, int(body * w / weight_sum)) for tid, w in weights.items()}
    return total, per_topic


def lookback_days(pref: TopicPref, day: date) -> int:
    """How far back to look for news on this topic (since it was last covered)."""
    if pref.frequency == "weekly":
        return 7
    if pref.frequency == "weekdays" and day.weekday() == 0:
        return 3  # Monday picks up the weekend
    return 1
