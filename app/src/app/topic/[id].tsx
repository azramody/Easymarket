import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { TopicEditor } from '@/components/topic-editor';
import { Banner, Button } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, radius, space, type } from '@/lib/theme';
import { defaultPref, TOPIC_BY_ID } from '@/lib/topics';

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const topic = TOPIC_BY_ID[id];
  const { prefs, savePref } = useStore();
  const existing = prefs[id];
  const [pref, setPref] = useState(existing ?? defaultPref(id));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!topic) return null;

  const save = async (enabled: boolean) => {
    setSaving(true);
    try {
      await savePref({ ...pref, enabled });
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ backgroundColor: topic.bg, borderRadius: radius.xl, padding: space.xl, gap: 6 }}>
        <Text style={{ fontSize: 34 }}>{topic.emoji}</Text>
        <Text style={[type.title, { color: topic.fg }]}>{topic.name}</Text>
        <Text style={[type.small, { color: topic.fg }]}>{existing?.enabled ? 'You follow this topic' : 'Not in your episodes yet'}</Text>
      </View>
      {err ? <Banner tone="warn" text={err} /> : null}
      <TopicEditor topic={topic} pref={pref} onChange={setPref} />
      <View style={{ gap: space.sm }}>
        <Button label={existing?.enabled ? 'Save changes' : 'Follow topic'} onPress={() => save(true)} loading={saving} />
        {existing?.enabled ? <Button label="Unfollow" variant="ghost" onPress={() => save(false)} /> : null}
      </View>
    </ScrollView>
  );
}
