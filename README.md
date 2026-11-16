# easymarket

Market news aggregator app that curates podcast episodes to make following markets easier.

A personal markets podcast. Pick your topics, set how deep and how often, and every morning
by 7am (Eastern) a fresh episode is waiting, built only from official data and mainstream news,
with every source linked. Lily, the in-app assistant, helps tune your topics and explains terms.

| Folder | What it is |
|---|---|
| `app/` | iOS app (Expo / React Native) |
| `pipeline/` | Nightly Python job: fetch → write (Gemini) → fact-check → voice (Kokoro) → publish |
| `supabase/` | Database schema and the `lily-chat` Edge Function |
| `shared/topics.json` | The topic catalog and colours, used by app, pipeline and Lily |
| `docs/SETUP.md` | Step-by-step setup (all free tiers) |
| `docs/SPEC.md` | Decisions and the feature backlog |

## How "nothing made up" is enforced
1. The writer only receives numbered sources: FRED/ECB values, plus outlet headlines and summaries.
2. Every segment must list the source ids it used; unknown ids are dropped.
3. Every number in the script is checked against the cited sources. If any don't match, Gemini
   gets one chance to fix them. Any sentence still holding an unverified number is removed and logged
   in the episode's show notes.
4. Analysis is allowed but framed as interpretation, and a disclaimer closes each episode.

## Dev
```
cd pipeline && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest -q
cd app && npm install && npx tsc --noEmit
EXPO_PUBLIC_DEMO=1 npx expo start   # click through the UI with placeholder data, no backend
```
