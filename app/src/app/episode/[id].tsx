import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChapterList, SourceList } from '@/components/episode-parts';
import { Banner, Disclaimer, Segmented, SectionTitle } from '@/components/ui';
import { Episode, getEpisode } from '@/lib/episodes';
import { usePlayer } from '@/lib/player';
import { colors, radius, space, type } from '@/lib/theme';
import { formatClock, formatDuration, prettyDate } from '@/lib/time';
import { TOPIC_BY_ID } from '@/lib/topics';

const RATES = [0.75, 1, 1.25, 1.5, 2];

export default function EpisodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ep, setEp] = useState<Episode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'chapters' | 'sources' | 'transcript'>('chapters');
  const player = usePlayer();
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    getEpisode(id).then(setEp).catch((e) => setErr(e?.message ?? 'Could not load episode'));
  }, [id]);

  if (err) return <View style={{ padding: space.xl }}><Banner tone="warn" text={err} /></View>;
  if (!ep) return <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />;

  const active = player.episode?.id === ep.id;
  const chapter = active ? player.currentChapter : null;
  const topic = chapter?.topic_id ? TOPIC_BY_ID[chapter.topic_id] : null;
  const pos = active ? player.position : 0;
  const dur = active ? player.duration : ep.duration_sec;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 80 }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={[styles.now, { backgroundColor: topic?.bg ?? colors.surface }]}>
        <Text style={type.caption}>{prettyDate(ep.episode_date)} · {ep.kind === 'extended' ? 'Weekly deep dive' : 'Daily'} · {formatDuration(ep.duration_sec)}</Text>
        <Text style={[type.title, { color: topic?.fg ?? colors.ink }]}>{topic ? `${topic.emoji} ${topic.name}` : ep.title}</Text>
        {chapter ? <Text style={type.body}>{chapter.title}</Text> : null}

        <Pressable
          style={styles.scrub}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="Seek"
          onPress={(e) => {
            if (active && dur && barWidth) player.seek((e.nativeEvent.locationX / barWidth) * dur);
          }}>
          <View style={[styles.fill, { width: `${dur ? (pos / dur) * 100 : 0}%`, backgroundColor: topic?.fg ?? colors.accent }]} />
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.small}>{formatClock(pos)}</Text>
          <Text style={type.small}>{formatClock(dur)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={() => active && player.skip(-15)} accessibilityLabel="Back 15 seconds"><Ionicons name="play-back-circle-outline" size={40} color={colors.ink} /></Pressable>
          <Pressable onPress={() => (active ? player.toggle() : player.load(ep))} style={styles.play} accessibilityLabel={active && player.playing ? 'Pause' : 'Play'}>
            {player.loading && active ? <ActivityIndicator color="#fff" /> : <Ionicons name={active && player.playing ? 'pause' : 'play'} size={30} color="#fff" />}
          </Pressable>
          <Pressable onPress={() => active && player.skip(30)} accessibilityLabel="Forward 30 seconds"><Ionicons name="play-forward-circle-outline" size={40} color={colors.ink} /></Pressable>
        </View>
        <Segmented options={RATES.map((r) => ({ id: r, label: `${r}×` }))} value={player.rate} onChange={player.setRate} />
        {player.error && active ? <Text style={[type.small, { color: colors.warning }]}>{player.error}</Text> : null}
        {!ep.audio_path ? <Banner tone="warn" text="Audio for older episodes is cleared to save space. The transcript and sources stay here." /> : null}
      </View>

      <Segmented
        options={[{ id: 'chapters', label: 'Chapters' }, { id: 'sources', label: `Sources (${ep.sources.length})` }, { id: 'transcript', label: 'Transcript' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'chapters' && <ChapterList episode={ep} current={chapter} onPick={(c) => player.load(ep, c.start)} />}
      {tab === 'sources' && (
        <View style={{ gap: space.md }}>
          <SectionTitle>Where the facts come from</SectionTitle>
          <SourceList sources={ep.sources} />
        </View>
      )}
      {tab === 'transcript' && <Text style={[type.body, { color: colors.ink }]} selectable>{ep.transcript}</Text>}
      <Disclaimer text={ep.show_notes.disclaimer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  now: { borderRadius: radius.xl, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: colors.border },
  scrub: { height: 10, borderRadius: 5, backgroundColor: 'rgba(37,35,44,0.08)', overflow: 'hidden', marginTop: space.sm },
  fill: { height: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xxl },
  play: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
