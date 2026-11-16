"""Nightly entry point: build today's episode for every user.

    python -m easymarket.main                 # normal run (Supabase + live sources)
    python -m easymarket.main --local prefs.json --out out/   # no Supabase; writes files locally
"""
from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import assemble, config, music, schedule, writer
from .llm import GeminiLLM, LLM
from .models import Script, Source, TopicPref
from .sources import ecb, fred, news
from .tts import make_tts

log = logging.getLogger("easymarket")

KEY_RELEASES = (
    "Consumer Price Index", "Employment Situation", "Gross Domestic Product", "Personal Income and Outlays",
    "FOMC", "Producer Price Index", "Advance Monthly Sales for Retail", "Unemployment Insurance Weekly Claims",
    "Consumer Sentiment", "New Residential Construction", "Existing Home Sales", "Industrial Production",
    "International Trade in Goods and Services", "Job Openings and Labor Turnover",
)


class SourceProvider:
    """Fetches each external source once per run and hands out copies per episode."""

    def __init__(self, settings: config.Settings, topics: dict):
        self.topics = topics
        self.fred = fred.FredClient(settings.fred_api_key) if settings.fred_api_key else None
        self.news = news.NewsFetcher(gnews_api_key=settings.gnews_api_key)
        self._ecb: dict[date, Source | None] = {}

    def fred_series(self, sid: str):
        return self.fred.series(sid) if self.fred else None

    def ecb(self, day: date) -> Source | None:
        if day not in self._ecb:
            self._ecb[day] = ecb.fetch(day, "tmp", [])
        return self._ecb[day]

    def calendar(self, day: date) -> list[str]:
        if not self.fred:
            return []
        rows = self.fred.upcoming_releases(day, 7)
        seen, out = set(), []
        for r in rows:
            name = r.get("release_name", "")
            if any(k.lower() in name.lower() for k in KEY_RELEASES) and (name, r["date"]) not in seen:
                seen.add((name, r["date"]))
                out.append(f"{r['date']}: {name}")
        return out[:12]

    def for_topic(self, pref: TopicPref, day: date, now: datetime) -> list[Source]:
        t = self.topics[pref.topic_id]
        window = schedule.lookback_days(pref, day)
        out: list[Source] = []
        for sid in t.get("fred", []):
            snap = self.fred_series(sid)
            if snap and snap.latest:
                out.append(fred.to_source(snap, day, "tmp", [t["id"]], fred.is_fresh_release(snap, day, window)))
        if t.get("ecb_fx"):
            e = self.ecb(day)
            if e:
                out.append(Source(**{**asdict(e), "topic_ids": [t["id"]]}))
        limit = 12 if pref.frequency == "weekly" else 6
        for item in news.select_for_topic(self.news, t, pref.custom_notes, now, window, limit):
            out.append(news.to_source(item, "tmp", t["id"]))
        return out

    def snapshot(self, day: date) -> dict:
        """Latest values of every tracked series, for Lily's chat answers."""
        data: dict = {"as_of": day.isoformat(), "series": {}}
        ids = sorted({s for t in self.topics.values() for s in t.get("fred", [])})
        for sid in ids:
            snap = self.fred_series(sid)
            if snap and snap.latest:
                data["series"][sid] = {"title": snap.title, "url": f"https://fred.stlouisfed.org/series/{sid}", "summary": fred.describe(snap, day)}
        e = self.ecb(day)
        if e:
            data["ecb_fx"] = {"title": e.title, "url": e.url, "summary": e.text}
        return data


def assign_ids(per_topic: dict[str, list[Source]]) -> tuple[dict[str, list[Source]], dict[str, Source]]:
    n = 0
    flat: dict[str, Source] = {}
    out: dict[str, list[Source]] = {}
    for tid, srcs in per_topic.items():
        out[tid] = []
        for s in srcs:
            n += 1
            s2 = Source(**{**asdict(s), "id": f"S{n}"})
            out[tid].append(s2)
            flat[s2.id] = s2
    return out, flat


def episode_title(day: date, kind: str) -> str:
    label = "Weekly deep dive" if kind == "extended" else "Daily"
    return f"{day.strftime('%A, %b')} {day.day} · {label}"


def render(script: Script, voice: str, tts, music_dir: Path) -> tuple[object, list[dict]]:
    m = music.cues(music_dir)
    intro_text = script.intro
    if script.toc and not any(t.get("one_liner", "") in intro_text for t in script.toc if t.get("one_liner")):
        intro_text += " " + " ".join(t["one_liner"] for t in script.toc if t.get("one_liner"))
    parts = [("music", "music", m["intro"]), ("voice", "intro", tts.speak(intro_text, voice))]
    for seg in script.segments:
        parts.append(("music", "music", m["transition"]))
        parts.append(("voice", seg.topic_id, tts.speak(seg.script, voice)))
    parts.append(("music", "music", m["transition"]))
    parts.append(("voice", "outro", tts.speak(f"{script.outro} {config.DISCLAIMER}", voice)))
    parts.append(("music", "music", m["outro"]))
    return assemble.build(parts)


def make_episode(
    user_id: str,
    prefs: list[TopicPref],
    profile: dict,
    day: date,
    provider: SourceProvider,
    llm: LLM,
    tts,
    history: dict[str, list[dict]],
    out_dir: Path,
    topics: dict,
) -> tuple[dict, Path] | None:
    due = schedule.due_topics(prefs, day)
    if not due:
        log.info("user %s: nothing scheduled for %s", user_id, day)
        return None
    kind = schedule.episode_kind(due)
    _, budget = schedule.word_budget(due)
    now = datetime.now(timezone.utc)
    per_topic, flat = assign_ids({p.topic_id: provider.for_topic(p, day, now) for p in due})
    prompt = writer.build_prompt(day, kind, due, topics, per_topic, budget, history, provider.calendar(day), profile.get("display_name"))
    script, fc_notes = writer.write_script(llm, prompt, due, flat)

    voice = profile.get("voice") or "af_heart"
    audio, marks = render(script, voice, tts, config.ASSETS_DIR / "music")
    mp3 = out_dir / user_id / f"{day.isoformat()}.mp3"
    duration = assemble.to_mp3(audio, mp3)

    seg_by_topic = {s.topic_id: s for s in script.segments}
    chapters = []
    for mark in marks:
        cid = mark["id"]
        if cid == "intro":
            chapters.append({"id": "intro", "topic_id": None, "title": "What's on today", "start": mark["start"]})
        elif cid == "outro":
            chapters.append({"id": "outro", "topic_id": None, "title": "Wrap-up", "start": mark["start"]})
        else:
            s = seg_by_topic[cid]
            chapters.append({
                "id": cid, "topic_id": cid, "title": s.title, "start": mark["start"], "summary": s.summary,
                "continues_from": s.continues_from, "source_ids": s.source_ids,
            })
    transcript = "\n\n".join(
        [script.intro]
        + [f"{topics[s.topic_id]['name']}: {s.title}\n{s.script}" for s in script.segments]
        + [script.outro, config.DISCLAIMER]
    )
    used = {i for s in script.segments for i in s.source_ids}
    row = {
        "user_id": user_id,
        "episode_date": day.isoformat(),
        "kind": kind,
        "title": episode_title(day, kind),
        "duration_sec": duration,
        "topic_ids": [s.topic_id for s in script.segments],
        "chapters": chapters,
        "transcript": transcript,
        "show_notes": {
            "toc": script.toc,
            "segments": [
                {"topic_id": s.topic_id, "title": s.title, "summary": s.summary, "continues_from": s.continues_from, "source_ids": s.source_ids}
                for s in script.segments
            ],
            "disclaimer": config.DISCLAIMER,
            "factcheck_removed": fc_notes,
        },
        "sources": [flat[i].to_note() for i in sorted(used, key=lambda x: int(x[1:]))],
    }
    return row, mp3


def _prefs_from_json(path: Path) -> dict[str, list[TopicPref]]:
    data = json.loads(path.read_text())
    return {uid: [TopicPref(**p) for p in prefs] for uid, prefs in data.items()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="episode date (YYYY-MM-DD); defaults to today in New York time")
    ap.add_argument("--local", type=Path, help="JSON of {user_id: [TopicPref...]}; skips Supabase")
    ap.add_argument("--out", type=Path, default=Path("out"))
    ap.add_argument("--force", action="store_true", help="rebuild even if today's episode exists")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    settings = config.Settings()
    topics = config.load_topics()
    day = date.fromisoformat(args.date) if args.date else datetime.now(config.TIMEZONE).date()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set")
    if not settings.fred_api_key:
        log.warning("FRED_API_KEY not set: episodes will have no official data series")

    provider = SourceProvider(settings, topics)
    llm = GeminiLLM(settings.gemini_api_key, settings.gemini_model)
    tts = make_tts(settings.tts_engine, settings.kokoro_model, settings.kokoro_voices)

    store = None
    if args.local:
        users = _prefs_from_json(args.local)
    else:
        from .store import Store

        if not (settings.supabase_url and settings.supabase_service_key):
            raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (or use --local)")
        store = Store(settings.supabase_url, settings.supabase_service_key)
        users = store.users_with_topics()
        store.save_snapshot(day, provider.snapshot(day))

    failures = 0
    for user_id, prefs in users.items():
        try:
            if store and not args.force and store.episode_exists(user_id, day):
                log.info("user %s: episode already exists", user_id)
                continue
            profile = store.profile(user_id) if store else {}
            history = store.history(user_id, day) if store else {}
            result = make_episode(user_id, prefs, profile, day, provider, llm, tts, history, args.out, topics)
            if not result:
                continue
            row, mp3 = result
            if store:
                row["audio_path"] = store.upload_audio(user_id, day, mp3)
                store.save_episode(row)
            else:
                (mp3.parent / f"{day.isoformat()}.json").write_text(json.dumps(row, indent=2))
            log.info("user %s: episode ready (%s, %.0fs)", user_id, row["kind"], row["duration_sec"])
        except Exception:
            failures += 1
            log.exception("user %s: episode failed", user_id)

    if store:
        store.prune_audio(day - timedelta(days=settings.audio_retention_days))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
