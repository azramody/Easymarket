import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { TopicChip } from '@/components/topic-chip';
import { Screen, SectionTitle } from '@/components/ui';
import { useStore } from '@/lib/store';
import { space, type } from '@/lib/theme';
import { CATEGORIES, DIFFICULTIES, scheduleLabel, TOPICS } from '@/lib/topics';

export default function Topics() {
  const { prefs } = useStore();
  const count = Object.values(prefs).filter((p) => p.enabled).length;
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={type.display}>Your topics</Text>
        <Text style={type.body}>
          {count ? `Following ${count}. ` : ''}Tap any topic to follow it, set how deep it goes, and how often you hear about it.
        </Text>
      </View>
      {CATEGORIES.map((c) => (
        <View key={c.id} style={{ gap: space.md }}>
          <SectionTitle>{c.name}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TOPICS.filter((t) => t.category === c.id).map((t) => {
              const p = prefs[t.id];
              const on = !!p?.enabled;
              const level = on ? DIFFICULTIES.find((d) => d.id === p.difficulty)?.label : undefined;
              return (
                <TopicChip
                  key={t.id}
                  topic={t}
                  selected={on}
                  subtitle={on ? `${level} · ${scheduleLabel(p)}` : undefined}
                  onPress={() => router.push(`/topic/${t.id}`)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}
