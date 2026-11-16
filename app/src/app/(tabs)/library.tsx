import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui';
import { Episode, listEpisodes } from '@/lib/episodes';
import { colors, font, radius, space, type } from '@/lib/theme';
import { formatDuration, prettyDate } from '@/lib/time';
import { TOPIC_BY_ID } from '@/lib/topics';

export default function Library() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      setItems(await listEpisodes(query));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load your library');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(q); }, [load])); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ padding: space.xl, paddingBottom: space.md, gap: space.md }}>
        <Text style={type.display}>Library</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.inkFaint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search past episodes and transcripts" placeholderTextColor={colors.inkFaint} style={styles.searchInput} returnKeyType="search" />
        </View>
        {err ? <Banner tone="warn" text={err} /> : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 180, gap: space.md }}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>{q ? 'No episodes match that search.' : 'Your past episodes will show up here.'}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/episode/${item.id}`)} style={styles.row}>
            <View style={styles.stack}>
              {item.topic_ids.slice(0, 4).map((id, i) => (
                <View key={id} style={[styles.stackDot, { backgroundColor: TOPIC_BY_ID[id]?.bg, marginLeft: i ? -10 : 0, zIndex: 10 - i }]}>
                  <Text style={{ fontSize: 12 }}>{TOPIC_BY_ID[id]?.emoji}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>{prettyDate(item.episode_date)}</Text>
              <Text style={type.small} numberOfLines={1}>
                {item.kind === 'extended' ? 'Weekly deep dive' : 'Daily'} · {formatDuration(item.duration_sec)} · {item.topic_ids.map((id) => TOPIC_BY_ID[id]?.name).join(', ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: font.medium, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md },
  stack: { flexDirection: 'row', width: 74 },
  stackDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
});
