import { DEMO, demoEpisode } from './demo';
import { supabase } from './supabase';

export type Chapter = {
  id: string;
  topic_id: string | null;
  title: string;
  start: number;
  summary?: string;
  continues_from?: string | null;
  source_ids?: string[];
};

export type SourceNote = { id: string; kind: 'data' | 'news' | 'official'; title: string; publisher: string; url: string; published: string };

export type Episode = {
  id: string;
  episode_date: string;
  kind: 'daily' | 'extended';
  title: string;
  audio_path: string | null;
  duration_sec: number;
  topic_ids: string[];
  chapters: Chapter[];
  transcript: string;
  show_notes: { toc?: { topic_id: string; one_liner: string }[]; disclaimer?: string };
  sources: SourceNote[];
};

const LIST_COLUMNS = 'id, episode_date, kind, title, audio_path, duration_sec, topic_ids, chapters, show_notes, sources';

export async function latestEpisode(): Promise<Episode | null> {
  if (DEMO) return demoEpisode;
  const { data, error } = await supabase.from('episodes').select(LIST_COLUMNS).order('episode_date', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as Episode) ?? null;
}

export async function listEpisodes(query: string): Promise<Episode[]> {
  if (DEMO) return [demoEpisode];
  let q = supabase.from('episodes').select(LIST_COLUMNS).order('episode_date', { ascending: false }).limit(60);
  if (query.trim()) q = q.textSearch('search', query.trim(), { type: 'websearch', config: 'english' });
  const { data, error } = await q;
  if (error) throw error;
  return (data as Episode[]) ?? [];
}

export async function getEpisode(id: string): Promise<Episode | null> {
  if (DEMO) return demoEpisode;
  const { data, error } = await supabase.from('episodes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Episode) ?? null;
}

export async function audioUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('episodes').createSignedUrl(path, 60 * 60 * 6);
  if (error || !data) throw error ?? new Error('No audio URL');
  return data.signedUrl;
}
