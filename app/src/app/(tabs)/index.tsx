import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterList } from '@/components/episode-parts';
import { TopicChip } from '@/components/topic-chip';
import { Banner, Button, Card, Disclaimer, SectionTitle } from '@/components/ui';
import { Episode, latestEpisode } from '@/lib/episodes';
import { usePlayer } from '@/lib/player';
import { enabledPrefs, useStore } from '@/lib/store';
import { colors, font, radius, space, type } from '@/lib/theme';
import { formatDuration, prettyDate, todayInNY } from '@/lib/time';
import { isDue, TOPIC_BY_ID } from '@/lib/topics';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const { profile, prefs, error } = useStore();
  const player = usePlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEpisode(await latestEpisode());
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load episodes');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const isToday = episode?.episode_date === todayInNY();
  const tomorrow = new Date(Date.now() + 86400000);
  const upNext = enabledPrefs(prefs).filter((p) => isDue(p, tomorrow));
  const nowPlaying = player.episode?.id === episode?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: 180, gap: space.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.small}>{greeting()}{profile.display_name ? `, ${profile.display_name}` : ''} ☁️</Text>
            <Text style={type.display}>easymarket</Text>
          </View>
          <Link href="/settings" asChild>
            <Pressable style={styles.iconBtn} accessibilityLabel="Settings"><Ionicons name="settings-outline" size={20} color={colors.ink} /></Pressable>
          </Link>
        </View>

        {error ? <Banner tone="warn" text={error} /> : null}
        {loadError ? <Banner tone="warn" text={loadError} /> : null}

        {loading && !episode ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : episode ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{isToday ? 'Fresh today' : prettyDate(episode.episode_date)}</Text>
                </View>
                <Text style={[type.small, { color: colors.inkSoft }]}>
                  {episode.kind === 'extended' ? 'Weekly deep dive' : 'Daily'} · {formatDuration(episode.duration_sec)}
                </Text>
              </View>
              <Text style={[type.title, { fontSize: 26, lineHeight: 32 }]}>{episode.title}</Text>
              <View style={styles.colorBar}>
                {episode.topic_ids.map((id) => (
                  <View key={id} style={{ flex: 1, backgroundColor: TOPIC_BY_ID[id]?.fg ?? colors.border }} />
                ))}
              </View>
              {episode.show_notes.toc?.length ? (
                <View style={{ gap: 8 }}>
                  {episode.show_notes.toc.filter((t) => t.one_liner).map((t) => (
                    <View key={t.topic_id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 14 }}>{TOPIC_BY_ID[t.topic_id]?.emoji}</Text>
                      <Text style={[type.body, { flex: 1, color: colors.ink }]}>{t.one_liner}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={nowPlaying && player.playing ? 'Pause' : nowPlaying ? 'Resume' : 'Play episode'}
                    icon={<Ionicons name={nowPlaying && player.playing ? 'pause' : 'play'} size={18} color="#fff" />}
                    loading={player.loading && nowPlaying}
                    onPress={() => (nowPlaying ? player.toggle() : player.load(episode))}
                  />
                </View>
                <Button label="Notes" variant="ghost" onPress={() => router.push(`/episode/${episode.id}`)} />
              </View>
              {player.error && nowPlaying ? <Text style={[type.small, { color: colors.warning }]}>{player.error}</Text> : null}
            </View>

            <SectionTitle>Chapters</SectionTitle>
            <ChapterList episode={episode} current={nowPlaying ? player.currentChapter : null} onPick={(c) => player.load(episode, c.start)} />
          </>
        ) : (
          <Card tint={colors.accentSoft}>
            <Text style={type.heading}>Your first episode is on its way ✨</Text>
            <Text style={type.body}>
              Episodes are made overnight and ready by 7am Eastern. Pull down to refresh after that.
            </Text>
          </Card>
        )}

        <SectionTitle right={<Link href="/topics" style={styles.link}>Edit</Link>}>Tomorrow's lineup</SectionTitle>
        {upNext.length ? (
          <View style={styles.chips}>
            {upNext.map((p) => <TopicChip key={p.topic_id} topic={TOPIC_BY_ID[p.topic_id]} size="sm" />)}
          </View>
        ) : (
          <Text style={type.body}>Nothing scheduled for tomorrow.</Text>
        )}

        <Disclaimer text={episode?.show_notes.disclaimer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.lg, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontFamily: font.bold, fontSize: 12, color: colors.accentInk },
  colorBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { fontFamily: font.bold, fontSize: 13, color: colors.accentInk },
});
