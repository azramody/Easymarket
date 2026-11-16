# easymarket: setup guide (all free tiers)

You'll create four free accounts/keys, paste a few values, and you're running.
Budget about 30–45 minutes the first time.

## 1. Get your API keys
| Key | Where | Notes |
|---|---|---|
| **Gemini API key** | https://aistudio.google.com/apikey | Free tier. Google may use free-tier prompts to improve its products. |
| **FRED API key** | https://fred.stlouisfed.org/docs/api/api_key.html | Free, official Federal Reserve data. |
| *(optional)* GNews key | https://gnews.io | 100 free requests/day; adds more news coverage. Skip it at first. |

## 2. Supabase (database, login, audio storage, Lily's backend)
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins".**
   (Each phone gets its own private account automatically; no passwords for v1.)
4. **Edge Functions → Deploy a new function → via Editor**, name it `lily-chat`,
   paste `supabase/functions/lily-chat/index.ts`, and add a second file `topics.json`
   with the contents of `supabase/functions/lily-chat/topics.json`. Deploy.
5. **Edge Functions → Secrets**: add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
6. **Project Settings → API**: copy the **Project URL**, the **anon public** key, and the
   **service_role** key (keep this one secret; it only goes into GitHub).

## 3. GitHub (the nightly episode builder)
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `GEMINI_API_KEY`
- `FRED_API_KEY`
- `SUPABASE_URL` (Project URL)
- `SUPABASE_SERVICE_ROLE_KEY`
- *(optional)* `GNEWS_API_KEY`

Optional **variable** `GEMINI_MODEL` if Google renames the free model (default `gemini-2.5-flash`).

The workflow `.github/workflows/daily-episodes.yml` runs every day at 09:15 UTC
(4:15am EST / 5:15am EDT). To test right away: **Actions → Daily episodes → Run workflow**
(tick *force* to rebuild today's episode after changing topics).

## 4. Run the app on your iPhone (no Mac, no Apple fee)
1. Install **Expo Go** from the App Store on your phone.
2. On any computer with Node 22:
   ```
   cd app
   cp .env.example .env      # paste Project URL + anon key
   npm install
   npx expo start --tunnel
   ```
3. Scan the QR code with the iPhone camera. The app opens in Expo Go.

### Letting friends try it
- Quickest: keep `npx expo start --tunnel` running and send them the QR / link (they need Expo Go).
- Without your computer on: create a free Expo account, then `npx eas-cli@latest update --branch main`
  and share the project's update link/QR from expo.dev.
- Each friend's phone gets its own account, topics and episodes.

## Free-tier limits to know about
- **Supabase storage 1 GB**: audio is ~3.6 MB per 10 min. Audio older than 30 days is deleted
  automatically (`AUDIO_RETENTION_DAYS`); transcripts, chapters and sources are kept forever.
- **Supabase pauses** projects after 7 days with no activity. The nightly job keeps it awake.
- **Gemini free tier** has per-day limits; each listener uses 1–2 requests a night plus Lily chats.
- **GitHub Actions**: free and unlimited minutes for public repos; 2,000 min/month for private.
  One episode takes roughly 3–8 minutes.
- **Notifications** are scheduled on the phone (7:00am ET). Real server push needs a paid
  Apple Developer account, so the reminder fires even if a nightly run failed; the app then
  shows the most recent episode.
- **Expo Go caveat**: background audio and lock-screen controls are more reliable in a real
  build (EAS Build + TestFlight, which needs the paid Apple account) than in Expo Go.
