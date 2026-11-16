import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chapter, Episode, SourceNote } from '@/lib/episodes';
import { colors, font, radius, space, type } from '@/lib/theme';
import { formatClock, prettyDate } from '@/lib/time';
import { TOPIC_BY_ID } from '@/lib/topics';

export function ChapterList({ episode, current, onPick }: { episode: Episode; current?: Chapter | null; onPick: (c: Chapter) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      {episode.chapters.map((c) => {
        const t = c.topic_id ? TOPIC_BY_ID[c.topic_id] : null;
        const on = current?.id === c.id;
        return (
          <Pressable key={c.id} onPress={() => onPick(c)} style={[styles.chapter, on && { borderColor: t?.fg ?? colors.accent }]} accessibilityRole="button">
            <View style={[styles.chapterIcon, { backgroundColor: t?.bg ?? colors.surfaceMuted }]}>
              <Text style={{ fontSize: 16 }}>{t?.emoji ?? (c.id === 'intro' ? '👋' : '✨')}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.caption, { color: t?.fg ?? colors.inkFaint }]}>{t?.name ?? (c.id === 'intro' ? 'Intro' : 'Outro')}</Text>
              <Text style={type.bodyStrong} numberOfLines={2}>{c.title}</Text>
              {c.continues_from ? (
                <Text style={[type.small, { color: colors.accentInk }]}>↺ Continues from {prettyDate(c.continues_from)}</Text>
              ) : null}
            </View>
            <Text style={styles.time}>{formatClock(c.start)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SourceList({ sources }: { sources: SourceNote[] }) {
  if (!sources.length) return <Text style={type.body}>No sources were used.</Text>;
  return (
    <View style={{ gap: space.sm }}>
      {sources.map((s) => (
        <Pressable key={s.id} onPress={() => s.url && openBrowserAsync(s.url)} style={styles.source} accessibilityRole="link">
          <View style={[styles.kind, { backgroundColor: s.kind === 'news' ? '#EEF2F8' : '#EAF5EE' }]}>
            <Ionicons name={s.kind === 'news' ? 'newspaper-outline' : s.kind === 'official' ? 'business-outline' : 'stats-chart-outline'} size={14} color={colors.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.small, { color: colors.ink, fontFamily: font.semibold }]} numberOfLines={2}>{s.title}</Text>
            <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>{s.publisher}{s.published ? ` · ${s.published.slice(0, 10)}` : ''}</Text>
          </View>
          <Ionicons name="open-outline" size={14} color={colors.inkFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chapter: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  chapterIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  kind: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
