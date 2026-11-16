"""Supabase reads/writes (service role; runs only inside GitHub Actions)."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from pathlib import Path

from .models import TopicPref

log = logging.getLogger(__name__)
BUCKET = "episodes"


class Store:
    def __init__(self, url: str, service_key: str):
        from supabase import create_client

        self.db = create_client(url, service_key)

    def users_with_topics(self) -> dict[str, list[TopicPref]]:
        rows = self.db.table("topic_prefs").select("*").eq("enabled", True).execute().data
        users: dict[str, list[TopicPref]] = {}
        for r in rows:
            users.setdefault(r["user_id"], []).append(
                TopicPref(
                    topic_id=r["topic_id"],
                    difficulty=r["difficulty"],
                    frequency=r["frequency"],
                    weekly_day=r["weekly_day"],
                    custom_notes=r.get("custom_notes") or "",
                    enabled=r["enabled"],
                )
            )
        return users

    def profile(self, user_id: str) -> dict:
        rows = self.db.table("profiles").select("*").eq("id", user_id).limit(1).execute().data
        return rows[0] if rows else {}

    def episode_exists(self, user_id: str, day: date) -> bool:
        rows = self.db.table("episodes").select("id").eq("user_id", user_id).eq("episode_date", day.isoformat()).limit(1).execute().data
        return bool(rows)

    def history(self, user_id: str, before: date, days: int = 14) -> dict[str, list[dict]]:
        rows = (
            self.db.table("episodes")
            .select("episode_date, chapters")
            .eq("user_id", user_id)
            .lt("episode_date", before.isoformat())
            .gte("episode_date", (before - timedelta(days=days)).isoformat())
            .order("episode_date", desc=True)
            .execute()
            .data
        )
        out: dict[str, list[dict]] = {}
        for r in rows:
            for ch in r.get("chapters") or []:
                if ch.get("topic_id") and ch.get("summary"):
                    out.setdefault(ch["topic_id"], []).append({"date": r["episode_date"], "summary": ch["summary"]})
        return out

    def upload_audio(self, user_id: str, day: date, mp3: Path) -> str:
        path = f"{user_id}/{day.isoformat()}.mp3"
        with open(mp3, "rb") as f:
            self.db.storage.from_(BUCKET).upload(path, f.read(), {"content-type": "audio/mpeg", "upsert": "true"})
        return path

    def save_episode(self, row: dict) -> None:
        self.db.table("episodes").upsert(row, on_conflict="user_id,episode_date").execute()

    def save_snapshot(self, day: date, data: dict) -> None:
        self.db.table("market_snapshots").upsert({"as_of": day.isoformat(), "data": data}, on_conflict="as_of").execute()

    def prune_audio(self, older_than: date) -> None:
        rows = (
            self.db.table("episodes")
            .select("id, audio_path")
            .lt("episode_date", older_than.isoformat())
            .not_.is_("audio_path", "null")
            .execute()
            .data
        )
        paths = [r["audio_path"] for r in rows if r["audio_path"]]
        if not paths:
            return
        self.db.storage.from_(BUCKET).remove(paths)
        for r in rows:
            self.db.table("episodes").update({"audio_path": None}).eq("id", r["id"]).execute()
        log.info("pruned %d old audio files (transcripts kept)", len(paths))
