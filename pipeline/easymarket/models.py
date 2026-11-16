"""Plain data types shared across the pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Difficulty = Literal["basic", "intermediate", "advanced"]
Frequency = Literal["daily", "weekdays", "weekly"]


@dataclass
class TopicPref:
    topic_id: str
    difficulty: Difficulty = "basic"
    frequency: Frequency = "daily"
    weekly_day: int = 6  # 0 = Monday ... 6 = Sunday
    custom_notes: str = ""
    enabled: bool = True


@dataclass
class Source:
    """One citable item. Every fact in a script must trace back to one of these."""

    id: str
    kind: Literal["data", "news", "official"]
    title: str
    publisher: str
    url: str
    published: str  # ISO date or datetime
    text: str  # the exact facts the writer is allowed to use
    topic_ids: list[str] = field(default_factory=list)

    def to_prompt(self) -> str:
        return f"[{self.id}] ({self.kind}) {self.publisher} | {self.published} | {self.title}\n{self.text}"

    def to_note(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "publisher": self.publisher,
            "url": self.url,
            "published": self.published,
        }


@dataclass
class Segment:
    topic_id: str
    title: str
    script: str
    summary: str
    source_ids: list[str]
    continues_from: str | None = None


@dataclass
class Script:
    intro: str
    toc: list[dict]  # [{topic_id, one_liner}]
    segments: list[Segment]
    outro: str
