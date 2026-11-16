import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { audioUrl, Chapter, Episode } from './episodes';
import { TOPIC_BY_ID } from './topics';

type PlayerCtx = {
  episode: Episode | null;
  playing: boolean;
  position: number;
  duration: number;
  loading: boolean;
  error: string | null;
  currentChapter: Chapter | null;
  load: (e: Episode, startAt?: number) => Promise<void>;
  toggle: () => void;
  seek: (sec: number) => void;
  skip: (delta: number) => void;
  rate: number;
  setRate: (r: number) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);

  useEffect(() => {
    // Keep playing with the screen locked / in the silent-switch position.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);

  const load = useCallback(
    async (e: Episode, startAt = 0) => {
      if (!e.audio_path) {
        setError('Audio for this episode has expired. The transcript and sources are still here.');
        return;
      }
      setError(null);
      if (episode?.id === e.id) {
        player.seekTo(startAt);
        player.play();
        return;
      }
      setLoading(true);
      try {
        const url = await audioUrl(e.audio_path);
        player.replace({ uri: url });
        setEpisode(e);
        if (startAt) await player.seekTo(startAt);
        player.setPlaybackRate(rate);
        player.play();
        try {
          player.setActiveForLockScreen(true, { title: e.title, artist: 'easymarket' }, { showSeekBackward: true, showSeekForward: true });
        } catch {}
      } catch (err: any) {
        setError(err?.message ?? 'Could not load audio');
      } finally {
        setLoading(false);
      }
    },
    [episode?.id, player, rate],
  );

  const toggle = useCallback(() => (status.playing ? player.pause() : player.play()), [player, status.playing]);
  const seek = useCallback((sec: number) => player.seekTo(Math.max(0, sec)), [player]);
  const skip = useCallback((d: number) => player.seekTo(Math.max(0, status.currentTime + d)), [player, status.currentTime]);
  const setRate = useCallback((r: number) => {
    setRateState(r);
    player.setPlaybackRate(r);
  }, [player]);

  const currentChapter = useMemo(() => {
    if (!episode) return null;
    let cur: Chapter | null = null;
    for (const c of episode.chapters) if (c.start <= status.currentTime + 0.5) cur = c;
    return cur;
  }, [episode, status.currentTime]);

  useEffect(() => {
    if (!episode || !currentChapter) return;
    const topic = currentChapter.topic_id ? TOPIC_BY_ID[currentChapter.topic_id]?.name : undefined;
    try {
      player.updateLockScreenMetadata({ title: topic ? `${topic} · ${currentChapter.title}` : episode.title, artist: 'easymarket' });
    } catch {}
  }, [currentChapter, episode, player]);

  const value: PlayerCtx = {
    episode,
    playing: status.playing,
    position: status.currentTime,
    duration: status.duration || episode?.duration_sec || 0,
    loading: loading || (status.isBuffering && !status.playing && !!episode),
    error: error ?? status.error ?? null,
    currentChapter,
    load,
    toggle,
    seek,
    skip,
    rate,
    setRate,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer outside PlayerProvider');
  return c;
}
