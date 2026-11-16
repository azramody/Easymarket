"""Headlines and summaries from free, public RSS feeds of mainstream outlets and
official institutions, plus Google News RSS search and (optionally) GNews.

We only ever pass the outlet's own headline and summary text to the writer, and every
item keeps its link so it can be listed in the show notes.
"""
from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

import feedparser
import httpx

from ..models import Source

log = logging.getLogger(__name__)

# General market/business feeds. Items are matched to topics by keyword.
GENERAL_FEEDS: dict[str, str] = {
    "CNBC": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "CNBC Finance": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    "CNBC Tech": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
    "CNBC World": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",
    "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "The Wall Street Journal (Markets)": "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
    "The Wall Street Journal (World)": "https://feeds.content.dowjones.io/public/rss/RSSWorldNews",
    "The Wall Street Journal (Tech)": "https://feeds.content.dowjones.io/public/rss/RSSWSJD",
    "BBC Business": "https://feeds.bbci.co.uk/news/business/rss.xml",
    "BBC World": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "BBC Technology": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "The New York Times (Business)": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "The New York Times (Economy)": "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml",
    "The New York Times (World)": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "The New York Times (Technology)": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "TechCrunch": "https://techcrunch.com/feed/",
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
}

# Official institutions. Topics opt into these via "official_feeds" in topics.json.
OFFICIAL_FEEDS: dict[str, tuple[str, str]] = {
    "fed": ("Federal Reserve Board", "https://www.federalreserve.gov/feeds/press_all.xml"),
    "ecb": ("European Central Bank", "https://www.ecb.europa.eu/rss/press.html"),
    "bls": ("U.S. Bureau of Labor Statistics", "https://www.bls.gov/feed/bls_latest.rss"),
    "bea": ("U.S. Bureau of Economic Analysis", "https://apps.bea.gov/rss/rss.xml"),
    "imf": ("International Monetary Fund", "https://www.imf.org/en/News/RSS?Language=ENG"),
}

USER_AGENT = "easymarket-podcast-bot/0.1 (+personal, non-commercial)"
_TAG = re.compile(r"<[^>]+>")


@dataclass
class NewsItem:
    title: str
    summary: str
    link: str
    publisher: str
    published: datetime | None
    official: bool = False

    @property
    def key(self) -> str:
        return re.sub(r"[^a-z0-9]", "", self.title.lower())[:80]


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", text or ""))).strip()


def _parse_time(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        t = entry.get(attr)
        if t:
            return datetime(*t[:6], tzinfo=timezone.utc)
    return None


def parse_feed(raw: bytes | str, publisher: str, official: bool = False) -> list[NewsItem]:
    parsed = feedparser.parse(raw)
    items = []
    for e in parsed.entries:
        title = _clean(e.get("title", ""))
        if not title:
            continue
        pub = publisher
        # Google News titles look like "Headline - Outlet"; keep the real outlet name.
        source = e.get("source")
        if source and getattr(source, "title", None):
            pub = source.title
            title = re.sub(rf"\s+-\s+{re.escape(source.title)}$", "", title)
        items.append(
            NewsItem(
                title=title,
                summary=_clean(e.get("summary", ""))[:600],
                link=e.get("link", ""),
                publisher=pub,
                published=_parse_time(e),
                official=official,
            )
        )
    return items


class NewsFetcher:
    def __init__(self, http: httpx.Client | None = None, gnews_api_key: str | None = None):
        self.http = http or httpx.Client(timeout=20, follow_redirects=True, headers={"User-Agent": USER_AGENT})
        self.gnews_api_key = gnews_api_key
        self._feed_cache: dict[str, list[NewsItem]] = {}

    def _feed(self, url: str, publisher: str, official: bool = False) -> list[NewsItem]:
        if url not in self._feed_cache:
            try:
                r = self.http.get(url)
                r.raise_for_status()
                self._feed_cache[url] = parse_feed(r.content, publisher, official)
            except Exception as e:
                log.warning("feed %s failed: %s", publisher, e)
                self._feed_cache[url] = []
        return self._feed_cache[url]

    def general(self) -> list[NewsItem]:
        out: list[NewsItem] = []
        for name, url in GENERAL_FEEDS.items():
            out.extend(self._feed(url, name))
        return out

    def official(self, key: str) -> list[NewsItem]:
        if key not in OFFICIAL_FEEDS:
            return []
        name, url = OFFICIAL_FEEDS[key]
        return self._feed(url, name, official=True)

    def google_news(self, query: str, days: int) -> list[NewsItem]:
        q = quote_plus(f"{query} when:{max(1, days)}d")
        url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
        return self._feed(url, "Google News")

    def gnews(self, query: str, since: datetime) -> list[NewsItem]:
        if not self.gnews_api_key:
            return []
        try:
            r = self.http.get(
                "https://gnews.io/api/v4/search",
                params={"q": query, "lang": "en", "max": 10, "from": since.strftime("%Y-%m-%dT%H:%M:%SZ"), "apikey": self.gnews_api_key},
            )
            r.raise_for_status()
            return [
                NewsItem(
                    title=_clean(a["title"]),
                    summary=_clean(a.get("description", "")),
                    link=a["url"],
                    publisher=a.get("source", {}).get("name", "GNews"),
                    published=datetime.fromisoformat(a["publishedAt"].replace("Z", "+00:00")),
                )
                for a in r.json().get("articles", [])
            ]
        except Exception as e:
            log.warning("GNews failed: %s", e)
            return []


def matches(item: NewsItem, keywords: list[str]) -> bool:
    hay = f" {item.title} {item.summary} ".lower()
    return any(k.lower() in hay for k in keywords)


def select_for_topic(
    fetcher: NewsFetcher,
    topic: dict,
    custom_notes: str,
    now: datetime,
    lookback_days: int,
    limit: int,
) -> list[NewsItem]:
    since = now - timedelta(days=lookback_days, hours=6)
    query = topic["news_query"]
    if custom_notes:
        # The user's own focus gets its own search so niche interests are covered.
        extra = fetcher.google_news(custom_notes[:120], lookback_days)
    else:
        extra = []
    pool: list[NewsItem] = []
    for key in topic.get("official_feeds", []):
        pool.extend(fetcher.official(key))
    pool.extend(i for i in fetcher.general() if matches(i, topic["keywords"]))
    pool.extend(fetcher.google_news(query, lookback_days))
    pool.extend(extra)
    pool.extend(fetcher.gnews(query, since))

    seen: set[str] = set()
    fresh: list[NewsItem] = []
    for item in pool:
        if item.published and item.published < since:
            continue
        if item.published is None and not item.official:
            continue  # can't confirm it's recent
        if item.key in seen:
            continue
        seen.add(item.key)
        fresh.append(item)
    # Official releases first, then the user's custom-focus results, then newest.
    extra_keys = {i.key for i in extra}
    fresh.sort(key=lambda i: (not i.official, i.key not in extra_keys, -(i.published.timestamp() if i.published else 0)))
    return fresh[:limit]


def to_source(item: NewsItem, source_id: str, topic_id: str) -> Source:
    text = item.title + (f". {item.summary}" if item.summary and item.summary.lower() != item.title.lower() else "")
    return Source(
        id=source_id,
        kind="official" if item.official else "news",
        title=item.title,
        publisher=item.publisher,
        url=item.link,
        published=item.published.isoformat() if item.published else "",
        text=text,
        topic_ids=[topic_id],
    )
