"""Turn sourced facts into a one-host podcast script with Gemini, then verify it."""
from __future__ import annotations

import json
import logging
from datetime import date

from . import factcheck
from .llm import LLM
from .models import Script, Segment, Source, TopicPref

log = logging.getLogger(__name__)

DIFFICULTY_GUIDE = {
    "basic": (
        "BASIC: assume no finance background. Explain every term the first time it appears in "
        "plain words (for example: 'Treasury yields, which is the interest the US government pays "
        "to borrow'). Focus on what happened and why an everyday person might care. Short sentences."
    ),
    "intermediate": (
        "INTERMEDIATE: assume the listener knows common terms (yields, CPI, rate cuts, earnings) "
        "but explain anything specialised. Connect the data to what markets are pricing and why."
    ),
    "advanced": (
        "ADVANCED: the listener follows markets closely. Use precise terminology (curve shape, "
        "real yields, breakevens, spreads, positioning) without defining basics. Discuss second-order "
        "implications and cross-asset links."
    ),
}

SYSTEM = """You are the writer and host of "easymarket", a personalised markets podcast for a Gen Z listener.
Voice: warm, upbeat and clear, a smart friend explaining the news. Never cheesy, no hype, no slang overload.

ABSOLUTE RULES ON FACTS
1. Every factual claim (numbers, events, quotes, dates, who-did-what) must come from the SOURCES provided. Do not use outside knowledge for facts about current events or data, and never invent numbers.
2. Write every number as digits exactly as it appears in a source (you may round to fewer decimals). Do not compute new numbers except simple rounding.
3. Each segment lists the source ids it used in "source_ids". Only use ids that exist.
4. You MAY add analysis: what a data point could imply, how it fits with other sources, what to watch next. Frame analysis as interpretation ("this could mean", "one read is") — never as fact or a prediction.
5. Never give personal financial advice or tell the listener to buy or sell anything.
6. Do not say "according to" or name sources in the audio; sources go in the show notes. Refer to institutions naturally only when they are the subject (e.g. "the Fed held rates").
7. If a topic has no meaningful sources, return that segment with a short honest line saying it was a quiet day for that topic and an empty source_ids list.
8. If a story continues something from PREVIOUS COVERAGE, say so briefly ("picking up from Tuesday...") and set continues_from to the date of that earlier episode. Otherwise null. Do not repeat old news as new.

STYLE
- Written for the ear: no bullet points, no markdown, no URLs, no emojis, no stage directions.
- Write "percent" as "%" after digits (it is converted for speech later), dollars as "$" before digits.
- Respect each topic's difficulty level and target word count.
- Respect the listener's custom focus notes for each topic.

Return ONLY JSON with this shape:
{
  "intro": "spoken greeting plus a quick table of contents, one line per topic",
  "toc": [{"topic_id": "...", "one_liner": "one sentence teaser"}],
  "segments": [{"topic_id": "...", "title": "short title", "script": "spoken text", "summary": "one-sentence factual summary for the archive", "source_ids": ["S1"], "continues_from": null}],
  "outro": "short spoken wrap-up (a disclaimer is appended automatically, do not write one)"
}"""


def build_prompt(
    day: date,
    kind: str,
    due: list[TopicPref],
    topics: dict,
    sources_by_topic: dict[str, list[Source]],
    budget: dict[str, int],
    history: dict[str, list[dict]],
    calendar: list[str],
    listener_name: str | None,
) -> str:
    parts = [
        f"EPISODE DATE: {day.strftime('%A, %B %d, %Y')} ({'extended weekly episode, ~30 minutes' if kind == 'extended' else 'daily episode, ~10 minutes'})",
        f"LISTENER NAME: {listener_name or 'not provided (do not use a name)'}",
        "Market prices are the most recent daily closes available; mention that they are closing levels where relevant.",
    ]
    for p in due:
        t = topics[p.topic_id]
        parts.append(
            "\n=== TOPIC: {name} (id: {id}) ===\nFrequency: {freq}{wk}\nDifficulty: {guide}\nTarget words: {words}\nListener's custom focus: {notes}".format(
                name=t["name"], id=t["id"], freq=p.frequency,
                wk=" (covers the past 7 days)" if p.frequency == "weekly" else "",
                guide=DIFFICULTY_GUIDE[p.difficulty], words=budget[p.topic_id],
                notes=p.custom_notes or "none",
            )
        )
        prev = history.get(p.topic_id, [])
        if prev:
            parts.append("PREVIOUS COVERAGE (already told to the listener):")
            parts.extend(f"- {h['date']}: {h['summary']}" for h in prev)
        srcs = sources_by_topic.get(p.topic_id, [])
        parts.append("SOURCES:" if srcs else "SOURCES: none")
        parts.extend(s.to_prompt() for s in srcs)
    if calendar:
        parts.append("\nOFFICIAL RELEASE CALENDAR FOR THE COMING WEEK (from FRED; you may mention what to watch):")
        parts.extend(f"- {c}" for c in calendar)
    return "\n".join(parts)


def _parse(raw: dict, valid_topics: set[str], valid_sources: set[str]) -> Script:
    segments = []
    for s in raw.get("segments", []):
        if s.get("topic_id") not in valid_topics:
            continue
        ids = [i for i in s.get("source_ids", []) if i in valid_sources]
        segments.append(
            Segment(
                topic_id=s["topic_id"],
                title=str(s.get("title", "")).strip(),
                script=str(s.get("script", "")).strip(),
                summary=str(s.get("summary", "")).strip(),
                source_ids=ids,
                continues_from=s.get("continues_from") or None,
            )
        )
    toc = [t for t in raw.get("toc", []) if t.get("topic_id") in valid_topics]
    return Script(intro=str(raw.get("intro", "")).strip(), toc=toc, segments=segments, outro=str(raw.get("outro", "")).strip())


def _problems(script: Script, sources: dict[str, Source]) -> dict[str, list[str]]:
    probs: dict[str, list[str]] = {}
    all_text = [s.text for s in sources.values()]
    for seg in script.segments:
        cited = [sources[i].text for i in seg.source_ids]
        bad = factcheck.unverified_numbers(seg.script, cited)
        if bad:
            probs[seg.topic_id] = bad
    for label, text in (("intro", script.intro + " " + " ".join(t.get("one_liner", "") for t in script.toc)), ("outro", script.outro)):
        bad = factcheck.unverified_numbers(text, all_text)
        if bad:
            probs[label] = bad
    return probs


def write_script(
    llm: LLM,
    prompt: str,
    due: list[TopicPref],
    sources: dict[str, Source],
) -> tuple[Script, list[str]]:
    """Returns the verified script and a list of human-readable fact-check notes."""
    valid_topics = {p.topic_id for p in due}
    raw = llm.generate_json(SYSTEM, prompt)
    script = _parse(raw, valid_topics, set(sources))
    notes: list[str] = []

    probs = _problems(script, sources)
    if probs:
        log.info("fact-check found unverified numbers, asking for a fix: %s", probs)
        fix_prompt = (
            prompt
            + "\n\nYOUR PREVIOUS DRAFT:\n" + json.dumps(raw)
            + "\n\nFACT-CHECK FAILED. These numbers do not appear in the cited sources: "
            + json.dumps(probs)
            + "\nRewrite the draft so every number appears in a cited source (or remove it). Return the full JSON again."
        )
        raw = llm.generate_json(SYSTEM, fix_prompt)
        script = _parse(raw, valid_topics, set(sources))
        probs = _problems(script, sources)

    # Anything still unverified is removed sentence by sentence.
    all_text = [s.text for s in sources.values()]
    for seg in script.segments:
        cited = [sources[i].text for i in seg.source_ids]
        seg.script, dropped = factcheck.strip_unverified(seg.script, cited)
        notes.extend(f"Removed from {seg.topic_id}: {d}" for d in dropped)
    script.intro, dropped = factcheck.strip_unverified(script.intro, all_text)
    notes.extend(f"Removed from intro: {d}" for d in dropped)
    script.outro, dropped = factcheck.strip_unverified(script.outro, all_text)
    notes.extend(f"Removed from outro: {d}" for d in dropped)
    for t in script.toc:
        if factcheck.unverified_numbers(t.get("one_liner", ""), all_text):
            t["one_liner"] = ""

    # Keep the topic order the listener expects.
    order = {p.topic_id: i for i, p in enumerate(due)}
    script.segments = [s for s in script.segments if s.script]
    script.segments.sort(key=lambda s: order[s.topic_id])
    return script, notes
