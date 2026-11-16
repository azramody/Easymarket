import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '@/lib/theme';
import { Topic } from '@/lib/topics';

export function TopicChip({ topic, selected, onPress, size = 'md', subtitle }: {
  topic: Topic; selected?: boolean; onPress?: () => void; size?: 'sm' | 'md'; subtitle?: string;
}) {
  const sm = size === 'sm';
  const body = (
    <View style={[styles.chip, sm && styles.chipSm, { backgroundColor: selected === false ? colors.surface : topic.bg, borderColor: selected === false ? colors.border : topic.bg }]}>
      <Text style={{ fontSize: sm ? 12 : 15 }}>{topic.emoji}</Text>
      <View>
        <Text style={[styles.label, sm && { fontSize: 12 }, { color: selected === false ? colors.ink : topic.fg }]} numberOfLines={1}>
          {topic.name}
        </Text>
        {subtitle ? <Text style={[styles.sub, { color: topic.fg }]}>{subtitle}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={16} color={topic.fg} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => pressed && { transform: [{ scale: 0.97 }] }}>
      {body}
    </Pressable>
  );
}

export function TopicDot({ topic, size = 10 }: { topic: Topic; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: topic.fg }} />;
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipSm: { paddingVertical: 5, paddingHorizontal: 10, gap: 5 },
  label: { fontFamily: font.semibold, fontSize: 14 },
  sub: { fontFamily: font.medium, fontSize: 11, opacity: 0.8 },
});
