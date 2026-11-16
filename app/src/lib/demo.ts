// Demo mode (EXPO_PUBLIC_DEMO=1): lets you click through the UI without a backend.
// Everything here is placeholder content, clearly labelled, and never shown in normal builds.
import type { Episode } from './episodes';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export const demoEpisode: Episode = {
  id: 'demo',
  episode_date: '2026-11-16',
  kind: 'daily',
  title: 'Sample episode (demo data)',
  audio_path: null,
  duration_sec: 612,
  topic_ids: ['fx-dollar', 'rates-bonds', 'ai', 'emerging-markets'],
  chapters: [
    { id: 'intro', topic_id: null, title: "What's on today", start: 6 },
    { id: 'fx-dollar', topic_id: 'fx-dollar', title: 'Placeholder: dollar segment', start: 48 },
    { id: 'rates-bonds', topic_id: 'rates-bonds', title: 'Placeholder: Treasury yields segment', start: 201, continues_from: '2026-11-13' },
    { id: 'ai', topic_id: 'ai', title: 'Placeholder: AI segment', start: 344 },
    { id: 'emerging-markets', topic_id: 'emerging-markets', title: 'Placeholder: emerging markets segment', start: 470 },
    { id: 'outro', topic_id: null, title: 'Wrap-up', start: 585 },
  ],
  transcript: 'Demo mode: real transcripts appear here once the nightly job has run.',
  show_notes: {
    toc: [
      { topic_id: 'fx-dollar', one_liner: 'Demo one-liner for the FX segment.' },
      { topic_id: 'rates-bonds', one_liner: 'Demo one-liner for the bonds segment.' },
      { topic_id: 'ai', one_liner: 'Demo one-liner for the AI segment.' },
    ],
  },
  sources: [
    { id: 'S1', kind: 'data', title: 'Example data source', publisher: 'FRED, Federal Reserve Bank of St. Louis', url: 'https://fred.stlouisfed.org/', published: '2026-11-13' },
    { id: 'S2', kind: 'news', title: 'Example news headline', publisher: 'Example outlet', url: 'https://example.com', published: '2026-11-16' },
  ],
};
