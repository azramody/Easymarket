import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopicChip } from '@/components/topic-chip';
import { Disclaimer } from '@/components/ui';
import { askLily, ChatMessage, Suggestion } from '@/lib/lily';
import { useStore } from '@/lib/store';
import { colors, font, radius, space, type } from '@/lib/theme';
import { defaultPref, DIFFICULTIES, FREQUENCIES, TOPIC_BY_ID, WEEKDAYS } from '@/lib/topics';

type Turn = ChatMessage & { suggestions?: Suggestion[]; sources?: { title: string; url: string }[]; applied?: boolean };
const KEY = 'easymarket.lily.v1';
const STARTERS = ['Help me pick topics for a career in FX', 'What are TIPS?', 'Make my AI updates weekly and advanced', 'What did the 10-year yield do recently?'];

function describe(s: Suggestion): string {
  const bits: string[] = [];
  if (s.enabled === false) bits.push('unfollow');
  else if (s.enabled) bits.push('follow');
  if (s.difficulty) bits.push(DIFFICULTIES.find((d) => d.id === s.difficulty)?.label ?? s.difficulty);
  if (s.frequency) bits.push(FREQUENCIES.find((f) => f.id === s.frequency)?.label + (s.frequency === 'weekly' && s.weekly_day != null ? ` (${WEEKDAYS[s.weekly_day]})` : ''));
  if (s.custom_notes) bits.push(`focus: "${s.custom_notes}"`);
  return bits.join(' · ');
}

export default function Lily() {
  const { prefs, savePrefs } = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setTurns(JSON.parse(v))).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(turns.slice(-40))).catch(() => {});
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [turns]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setInput('');
    setBusy(true);
    try {
      const r = await askLily(next.map(({ role, content }) => ({ role, content })));
      setTurns([...next, { role: 'assistant', content: r.reply, suggestions: r.suggestions, sources: r.sources }]);
    } catch (e: any) {
      setTurns([...next, { role: 'assistant', content: `Sorry, I couldn't answer just now (${e?.message ?? 'network error'}). Try again in a moment.` }]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (i: number) => {
    const t = turns[i];
    if (!t.suggestions?.length) return;
    await savePrefs(
      t.suggestions.map(({ reason, ...s }) => ({
        ...(prefs[s.topic_id] ?? defaultPref(s.topic_id)),
        ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)),
        enabled: s.enabled ?? true,
      })) as any,
    );
    setTurns(turns.map((x, j) => (j === i ? { ...x, applied: true } : x)));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={{ fontSize: 20 }}>🌸</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>Lily</Text>
            <Text style={type.small}>Shape your topics or ask anything about markets</Text>
          </View>
          {turns.length ? (
            <Pressable onPress={() => setTurns([])} hitSlop={10} accessibilityLabel="Clear chat"><Ionicons name="refresh" size={20} color={colors.inkSoft} /></Pressable>
          ) : null}
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.xl, gap: space.md, paddingBottom: 40 }}>
          {!turns.length ? (
            <View style={{ gap: space.sm }}>
              <Text style={type.body}>Hi! I'm Lily. Tell me what you're curious about and I'll suggest topic settings, or ask me to explain anything you hear in an episode.</Text>
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={styles.starter}><Text style={type.bodyStrong}>{s}</Text></Pressable>
              ))}
            </View>
          ) : null}
          {turns.map((t, i) => (
            <View key={i} style={{ alignItems: t.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
              <View style={[styles.bubble, t.role === 'user' ? styles.mine : styles.theirs]}>
                <Text style={[type.body, { color: t.role === 'user' ? '#fff' : colors.ink }]}>{t.content}</Text>
              </View>
              {t.sources?.length ? (
                <View style={{ gap: 4, maxWidth: '88%' }}>
                  {t.sources.map((s) => (
                    <Pressable key={s.url} onPress={() => openBrowserAsync(s.url)}><Text style={[type.small, { color: colors.accentInk }]}>↗ {s.title}</Text></Pressable>
                  ))}
                </View>
              ) : null}
              {t.suggestions?.length ? (
                <View style={styles.suggest}>
                  <Text style={type.caption}>Suggested changes</Text>
                  {t.suggestions.map((s) => TOPIC_BY_ID[s.topic_id] && (
                    <View key={s.topic_id} style={{ gap: 4 }}>
                      <TopicChip topic={TOPIC_BY_ID[s.topic_id]} size="sm" />
                      <Text style={type.small}>{describe(s)}</Text>
                    </View>
                  ))}
                  <Pressable disabled={t.applied} onPress={() => apply(i)} style={[styles.apply, t.applied && { backgroundColor: colors.surfaceMuted }]}>
                    <Text style={{ fontFamily: font.bold, color: t.applied ? colors.inkSoft : '#fff' }}>{t.applied ? 'Applied ✓' : 'Apply to my topics'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {busy ? <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} /> : null}
          {turns.length ? <Disclaimer text="Lily explains concepts and uses the latest official data she has. She can be wrong, and nothing here is financial advice." /> : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Lily…"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable onPress={() => send(input)} style={styles.send} accessibilityLabel="Send"><Ionicons name="arrow-up" size={20} color="#fff" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDE4F2', alignItems: 'center', justifyContent: 'center' },
  starter: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14 },
  mine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  suggest: { maxWidth: '88%', backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  apply: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  composer: { flexDirection: 'row', gap: space.sm, padding: space.md, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, paddingVertical: 12, fontFamily: font.medium, fontSize: 15, color: colors.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
