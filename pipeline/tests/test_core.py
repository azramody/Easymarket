import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from easymarket import config, factcheck, schedule, writer
from easymarket.main import make_episode
from easymarket.models import Source, TopicPref
from easymarket.sources import fred, news
from easymarket.tts import DummyTTS, normalize_for_speech

MON, SAT, SUN = date(2026, 11, 16), date(2026, 11, 21), date(2026, 11, 22)


def test_schedule_due_and_kind():
    prefs = [
        TopicPref("fx-dollar", frequency="daily"),
        TopicPref("ai", frequency="weekly", weekly_day=6),
        TopicPref("us-stocks", frequency="weekdays"),
    ]
    assert [p.topic_id for p in schedule.due_topics(prefs, MON)] == ["fx-dollar", "us-stocks"]
    assert schedule.episode_kind(schedule.due_topics(prefs, MON)) == "daily"
    sun = schedule.due_topics(prefs, SUN)
    assert [p.topic_id for p in sun] == ["fx-dollar", "ai"]
    assert schedule.episode_kind(sun) == "extended"
    assert [p.topic_id for p in schedule.due_topics(prefs, SAT)] == ["fx-dollar"]


def test_word_budget_weights_weekly_topics():
    due = [TopicPref("fx-dollar"), TopicPref("ai", frequency="weekly")]
    total, per = schedule.word_budget(due)
    assert total == 30 * 150
    assert per["ai"] == 3 * per["fx-dollar"]


def test_lookback():
    assert schedule.lookback_days(TopicPref("x", frequency="weekdays"), MON) == 3
    assert schedule.lookback_days(TopicPref("x", frequency="weekly"), MON) == 7
    assert schedule.lookback_days(TopicPref("x", frequency="daily"), MON) == 1


@pytest.mark.parametrize(
    "script,ok",
    [
        ("The 10-year yield closed at 4.42% on November 13.", True),
        ("The 10-year yield closed at 4.4%.", True),  # rounding of 4.42
        ("The 10-year yield closed at 4.6%.", False),
        ("That is a move of 6 basis points.", True),  # 0.06 -> 6 bp
        ("Analysts expect 37 more cuts.", False),
        ("Back in 2024 rates were higher.", True),
        ("The dollar index rose 1.25%.", False),
    ],
)
def test_factcheck(script, ok):
    src = ["Latest value: 4.42 Percent (observation date 2026-11-13). Previous observation: 4.36 Percent; change +0.06 Percent."]
    assert (factcheck.unverified_numbers(script, src) == []) is ok


def test_strip_unverified_drops_only_bad_sentences():
    text, dropped = factcheck.strip_unverified("Yields hit 4.42%. Someone said 99 things. Nice.", ["4.42"])
    assert text == "Yields hit 4.42%. Nice."
    assert dropped == ["Someone said 99 things."]


def test_normalize_for_speech():
    assert normalize_for_speech("S&P 500 fell -0.4% to $5,900") == "S and P 500 fell minus 0.4 percent to 5900 dollars"
    assert normalize_for_speech("up 25bps in Q3") == "up 25 basis points in third quarter"
    assert normalize_for_speech("$1.2 billion deal") == "1.2 billion dollars deal"


def test_fred_describe_uses_only_api_values():
    snap = fred.SeriesSnapshot("DGS10", "Market Yield on U.S. Treasury Securities at 10-Year", "Percent", "D", "2026-11-14 15:16:01-06",
                               [("2026-11-13", 4.42), ("2026-11-12", 4.36), ("2026-11-06", 4.30)])
    text = fred.describe(snap, MON)
    assert "4.42 Percent (observation date 2026-11-13)" in text
    assert "+0.06 Percent" in text
    assert fred.is_fresh_release(snap, MON, 3)
    assert not fred.is_fresh_release(snap, MON, 1)


def test_parse_google_news_feed():
    raw = """<?xml version="1.0"?><rss><channel><item>
      <title>Dollar slips as traders weigh Fed path - Reuters</title><link>https://example.com/a</link>
      <pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate><description>&lt;b&gt;Dollar&lt;/b&gt; slips</description>
      <source url="https://www.reuters.com">Reuters</source></item></channel></rss>"""
    items = news.parse_feed(raw, "Google News")
    assert items[0].title == "Dollar slips as traders weigh Fed path"
    assert items[0].publisher == "Reuters"
    assert items[0].published == datetime(2026, 11, 16, 8, tzinfo=timezone.utc)


class FakeLLM:
    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts = []

    def generate_json(self, system, prompt):
        self.prompts.append(prompt)
        return self.responses.pop(0)


def _draft(number):
    return {
        "intro": "Hey, happy Monday. Today: the dollar.",
        "toc": [{"topic_id": "fx-dollar", "one_liner": "The dollar edged up."}],
        "segments": [{
            "topic_id": "fx-dollar", "title": "Dollar edges up",
            "script": f"The broad dollar index closed at {number}. That could mean traders see the Fed staying patient.",
            "summary": "The broad dollar index rose.", "source_ids": ["S1", "S99"], "continues_from": None,
        }],
        "outro": "That's it for today.",
    }


SRC = {"S1": Source("S1", "data", "Nominal Broad U.S. Dollar Index", "FRED", "https://fred.stlouisfed.org/series/DTWEXBGS",
                    "2026-11-13", "Latest value: 121.35 Index (observation date 2026-11-13).", ["fx-dollar"])}


def test_writer_repairs_then_accepts():
    llm = FakeLLM([_draft("125.00"), _draft("121.35")])
    script, notes = writer.write_script(llm, "PROMPT", [TopicPref("fx-dollar")], SRC)
    assert len(llm.prompts) == 2 and "FACT-CHECK FAILED" in llm.prompts[1]
    assert "121.35" in script.segments[0].script
    assert script.segments[0].source_ids == ["S1"]  # unknown S99 dropped
    assert notes == []


def test_writer_strips_if_repair_fails():
    llm = FakeLLM([_draft("125.00"), _draft("130.00")])
    script, notes = writer.write_script(llm, "PROMPT", [TopicPref("fx-dollar")], SRC)
    assert "130" not in script.segments[0].script
    assert script.segments[0].script.startswith("That could mean")
    assert notes and "130.00" in notes[0]


class FakeProvider:
    def for_topic(self, pref, day, now):
        return [Source(**{**SRC["S1"].__dict__, "id": "tmp"})]

    def calendar(self, day):
        return ["2026-11-18: Consumer Price Index"]


def test_make_episode_end_to_end(tmp_path: Path):
    llm = FakeLLM([_draft("121.35")])
    row, mp3 = make_episode("u1", [TopicPref("fx-dollar")], {}, MON, FakeProvider(), llm, DummyTTS(), {}, tmp_path, config.load_topics())
    assert mp3.exists() and mp3.stat().st_size > 10_000
    assert row["kind"] == "daily"
    assert [c["id"] for c in row["chapters"]] == ["intro", "fx-dollar", "outro"]
    starts = [c["start"] for c in row["chapters"]]
    assert starts == sorted(starts) and starts[0] > 5  # intro music plays first
    assert row["sources"][0]["url"].startswith("https://fred.stlouisfed.org")
    assert config.DISCLAIMER in row["transcript"]
    assert "Consumer Price Index" in llm.prompts[0]
    json.dumps(row)  # serialisable for Supabase
