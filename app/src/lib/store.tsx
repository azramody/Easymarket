import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEMO } from './demo';
import { ensureSession, isConfigured, supabase } from './supabase';
import { defaultPref, TopicPref } from './topics';

export type Profile = { display_name: string | null; voice: string; onboarded: boolean };

type Ctx = {
  ready: boolean;
  error: string | null;
  userId: string | null;
  profile: Profile;
  prefs: Record<string, TopicPref>;
  savePref: (p: TopicPref) => Promise<void>;
  savePrefs: (ps: TopicPref[]) => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  reload: () => Promise<void>;
};

const DEFAULT_PROFILE: Profile = { display_name: null, voice: 'af_heart', onboarded: false };
const CACHE_KEY = 'easymarket.cache.v1';
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [prefs, setPrefs] = useState<Record<string, TopicPref>>({});

  const persist = (p: Profile, t: Record<string, TopicPref>) =>
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ profile: p, prefs: t })).catch(() => {});

  const reload = useCallback(async () => {
    // Show cached state instantly, then refresh from Supabase.
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        setProfile(c.profile);
        setPrefs(c.prefs);
      }
    } catch {}
    if (DEMO) {
      setReady(true);
      return;
    }
    if (!isConfigured) {
      setError('Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to app/.env.');
      setReady(true);
      return;
    }
    try {
      const uid = await ensureSession();
      setUserId(uid);
      const [{ data: prof }, { data: rows, error: e2 }] = await Promise.all([
        supabase.from('profiles').select('display_name, voice, onboarded').eq('id', uid).maybeSingle(),
        supabase.from('topic_prefs').select('topic_id, enabled, difficulty, frequency, weekly_day, custom_notes'),
      ]);
      if (e2) throw e2;
      let p = prof as Profile | null;
      if (!p) {
        await supabase.from('profiles').insert({ id: uid });
        p = DEFAULT_PROFILE;
      }
      const t = Object.fromEntries((rows ?? []).map((r: TopicPref) => [r.topic_id, r]));
      setProfile(p);
      setPrefs(t);
      persist(p, t);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the server');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const savePrefs = useCallback(
    async (ps: TopicPref[]) => {
      const next = { ...prefs };
      ps.forEach((p) => (next[p.topic_id] = { ...defaultPref(p.topic_id), ...p }));
      setPrefs(next);
      persist(profile, next);
      if (!userId) return;
      const { error: e } = await supabase
        .from('topic_prefs')
        .upsert(ps.map((p) => ({ ...p, user_id: userId, updated_at: new Date().toISOString() })));
      if (e) throw e;
    },
    [prefs, profile, userId],
  );

  const savePref = useCallback((p: TopicPref) => savePrefs([p]), [savePrefs]);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const next = { ...profile, ...patch };
      setProfile(next);
      persist(next, prefs);
      if (!userId) return;
      const { error: e } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (e) throw e;
    },
    [profile, prefs, userId],
  );

  const value = useMemo(
    () => ({ ready, error, userId, profile, prefs, savePref, savePrefs, saveProfile, reload }),
    [ready, error, userId, profile, prefs, savePref, savePrefs, saveProfile, reload],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}

export function enabledPrefs(prefs: Record<string, TopicPref>): TopicPref[] {
  return Object.values(prefs).filter((p) => p.enabled);
}
