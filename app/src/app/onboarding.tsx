import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopicChip } from '@/components/topic-chip';
import { TopicEditor } from '@/components/topic-editor';
import { Banner, Button, Card, SectionTitle } from '@/components/ui';
import { requestNotifications } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { colors, font, radius, space, type } from '@/lib/theme';
import { CATEGORIES, defaultPref, TOPIC_BY_ID, TOPICS, TopicPref } from '@/lib/topics';

export default function Onboarding() {
  const { savePrefs, saveProfile, profile, prefs: existing } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? '');
  const [picked, setPicked] = useState<Record<string, TopicPref>>(
    Object.fromEntries(Object.values(existing).filter((p) => p.enabled).map((p) => [p.topic_id, p])),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = defaultPref(id);
      return next;
    });

  const finish = async (notify: boolean) => {
    setSaving(true);
    setErr(null);
    try {
      const all = TOPICS.map((t) => picked[t.id] ?? (existing[t.id] ? { ...existing[t.id], enabled: false } : null)).filter(Boolean) as TopicPref[];
      await savePrefs(all);
      if (notify) await requestNotifications().catch(() => false);
      await saveProfile({ display_name: name.trim() || null, onboarded: true });
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong saving your setup');
    } finally {
      setSaving(false);
    }
  };

  const count = Object.keys(picked).length;
  const dots = (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ height: 6, width: i === step ? 22 : 6, borderRadius: 3, backgroundColor: i <= step ? colors.ink : colors.border }} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 240 }}>
        {dots}
        {err ? <Banner tone="warn" text={err} /> : null}

        {step === 0 && (
          <>
            <View style={{ gap: space.md, marginTop: space.xl }}>
              <Text style={{ fontSize: 44 }}>🎧</Text>
              <Text style={[type.display, { fontSize: 36, lineHeight: 42 }]}>Markets, minus the noise.</Text>
              <Text style={type.body}>
                easymarket makes you a personal podcast every morning, only on the topics you care about, explained at the level you want.
              </Text>
            </View>
            <View style={{ gap: space.sm }}>
              <Text style={type.caption}>What should we call you? (optional)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor={colors.inkFaint}
                style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, fontFamily: font.medium, fontSize: 16, color: colors.ink }}
              />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={type.title}>Pick your topics</Text>
              <Text style={type.body}>Choose as many as you like. You can fine-tune them, or ask Lily for help, any time.</Text>
            </View>
            {CATEGORIES.map((c) => (
              <View key={c.id} style={{ gap: space.md }}>
                <SectionTitle>{c.name}</SectionTitle>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TOPICS.filter((t) => t.category === c.id).map((t) => (
                    <TopicChip key={t.id} topic={t} selected={!!picked[t.id]} onPress={() => toggle(t.id)} />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={type.title}>Set the depth & rhythm</Text>
              <Text style={type.body}>
                For each topic, choose how technical it gets and how often it shows up. Daily topics make a ~10 min episode; weekly ones add a ~30 min deep dive on their day.
              </Text>
            </View>
            {Object.values(picked).map((p) => {
              const t = TOPIC_BY_ID[p.topic_id];
              return (
                <Card key={p.topic_id}>
                  <TopicChip topic={t} />
                  <TopicEditor topic={t} pref={p} showNotes={false} onChange={(np) => setPicked((cur) => ({ ...cur, [np.topic_id]: np }))} />
                </Card>
              );
            })}
          </>
        )}

        {step === 3 && (
          <View style={{ gap: space.lg, marginTop: space.xl }}>
            <Text style={{ fontSize: 44 }}>⏰</Text>
            <Text style={type.title}>Ready by 7am</Text>
            <Text style={type.body}>
              Your episode is built overnight. Want a nudge at 7:00am Eastern when it's ready?
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, paddingBottom: 40, backgroundColor: colors.bg, gap: space.sm }}>
        {step < 3 ? (
          <Button
            label={step === 1 ? (count ? `Continue with ${count}` : 'Pick at least one') : 'Continue'}
            disabled={step === 1 && !count}
            onPress={() => setStep(step + 1)}
          />
        ) : (
          <>
            <Button label="Turn on notifications" onPress={() => finish(true)} loading={saving} />
            <Button label="Maybe later" variant="ghost" onPress={() => finish(false)} disabled={saving} />
          </>
        )}
        {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
      </View>
    </SafeAreaView>
  );
}
