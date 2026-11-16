import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePlayer } from '@/lib/player';
import { colors, font, radius, shadow } from '@/lib/theme';
import { TOPIC_BY_ID } from '@/lib/topics';

export function MiniPlayer() {
  const p = usePlayer();
  const path = usePathname();
  if (!p.episode || path === '/lily') return null;
  const topic = p.currentChapter?.topic_id ? TOPIC_BY_ID[p.currentChapter.topic_id] : null;
  const pct = p.duration ? Math.min(1, p.position / p.duration) : 0;
  return (
    <Pressable style={[styles.wrap, shadow]} onPress={() => router.push(`/episode/${p.episode!.id}`)} accessibilityLabel="Open now playing">
      <View style={[styles.swatch, { backgroundColor: topic?.bg ?? colors.accentSoft }]}>
        <Text style={{ fontSize: 18 }}>{topic?.emoji ?? '🎧'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{topic ? topic.name : p.currentChapter?.title ?? p.episode.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{p.episode.title}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: topic?.fg ?? colors.accent }]} /></View>
      </View>
      <Pressable onPress={() => p.skip(-15)} hitSlop={8} accessibilityLabel="Back 15 seconds">
        <Ionicons name="play-back" size={20} color={colors.inkSoft} />
      </Pressable>
      <Pressable onPress={p.toggle} hitSlop={8} style={styles.play} accessibilityLabel={p.playing ? 'Pause' : 'Play'}>
        {p.loading ? <ActivityIndicator color="#fff" /> : <Ionicons name={p.playing ? 'pause' : 'play'} size={20} color="#fff" />}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 92, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  swatch: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 14, color: colors.ink },
  sub: { fontFamily: font.medium, fontSize: 12, color: colors.inkFaint },
  track: { height: 3, backgroundColor: colors.surfaceMuted, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: 3 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
