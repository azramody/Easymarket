# easymarket — Product Spec & Feature Backlog

Status: v1 core built. See docs/SETUP.md to run it.

## Decisions so far
| Area | Decision |
|---|---|
| Platform | iOS app built with Expo (React Native); tested through Expo Go, no paid Apple account |
| Users | Owner first; friends test and give feedback |
| Build order | Core first; everything else stays in the backlog below |
| Budget | Free services only |
| News | Free sources, mixed: RSS feeds + free aggregator APIs |
| Economic data | Official sources only (FRED, BLS, BEA, Treasury, ECB, IMF, World Bank, etc.) |
| Prices | Daily; episode uses the most recent available price |
| Citations | Written source list + show notes; host does not say "according to" |
| Analysis | LLM-generated analysis allowed, with a disclaimer at the start or end |
| LLM | Google Gemini free tier, one model everywhere (configurable name) |
| Voice | Kokoro (open-source) TTS, one host, English; 5 voices selectable in Settings |
| Length | Daily ~10 min; weekly ~30 min |
| Structure | Intro (table of contents with one-liners) → music → topic → music → … → conclusion |
| Scheduling | Per-topic frequency; overlapping days produce one combined episode |
| Weekend/weekly | New content only; flag when a story continues a previous episode |
| Difficulty | Basic / Intermediate / Advanced, set per topic |
| Notifications | Local daily reminder at 7:00am Eastern (server push needs paid Apple account) |
| Hosting | GitHub Actions nightly job (09:15 UTC) + Supabase free tier |
| Prices | Previous trading day's close |
| Music | Self-synthesised cues (no licensing); swappable for royalty-free files |
| Archive | Past episodes + transcripts saved and searchable |
| Disclaimers | Wherever they apply (episodes, Lily answers, analysis) |
| Design refs | Braze, HubSpot, Salesforce; pastel neutral; a color per topic; light mode only |
| Name | easymarket |

## Core (v1) — built
- Onboarding: name, topic picker, per-topic depth + frequency, notification opt-in
- Topics tab: follow/unfollow, depth, frequency (daily / weekdays / weekly + day), focus notes
- Lily chat (text): suggests topic changes (tap to apply) and answers market questions,
  using only the latest official data snapshot for current numbers
- Nightly pipeline: FRED + ECB data, official RSS (Fed, ECB, BLS, BEA, IMF), mainstream RSS,
  Google News RSS → Gemini script → number fact-check → Kokoro TTS → music → MP3 → Supabase
- Combined daily (~10 min) / extended (~30 min when a weekly topic is due) episodes
- Continuation notes from the last 14 days of episodes
- Player with chapters, speed, lock screen; show notes with sources; transcript; disclaimers
- Library with full-text search over transcripts

## Backlog (revisit later)
- **Lily voice (next up)**: in-app "Ask Lily" button + earbud trigger. Plan: map the AirPods
  double-press (iOS "next track" remote command) to "ask Lily" → pause → record question →
  speech-to-text → Lily answers by voice in the host's voice → episode resumes. Needs a
  development build (custom native modules), not Expo Go.
- More voices/accents (v1 has 5 English Kokoro voices)
- More languages
- Wake word "hey lily" fully hands-free
- Offline downloads
- Dark mode
- Android / web
- Paid/licensed outlets (WSJ, Bloomberg, Reuters) if budget allows

## Topic list (approved)
Markets: US Stocks · Global Stocks · FX & the Dollar · Emerging Markets · Rates & Bonds (incl. TIPS) · Commodities (oil, gold, ags) · Crypto & Digital Assets
Macro: Central Banks & the Fed · Inflation & Jobs Data · Growth & GDP · Trade & Tariffs
World: International Politics & Geopolitics · China · Europe · Latin America
Tech & business: AI · Semiconductors · Big Tech & Earnings · Fintech & Banking · Venture & Startups · Energy Transition
Money: Housing & Real Estate · Personal Finance Basics
- Server push notifications sent only after an episode is actually built (paid Apple account)
- TestFlight distribution for friends (paid Apple account)
