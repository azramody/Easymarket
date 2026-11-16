import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { Banner, Card, Screen, SectionTitle } from '@/components/ui';
import { disableNotifications, notificationsEnabled, requestNotifications } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { colors, font, radius, space, type } from '@/lib/theme';
import { localTimeFor, NOTIFY_HOUR } from '@/lib/time';

// Must match pipeline/easymarket/tts.py VOICES.
const VOICES = [
  { id: 'af_heart', label: 'Heart', hint: 'American · warm' },
  { id: 'af_bella', label: 'Bella', hint: 'American · bright' },
  { id: 'am_michael', label: 'Michael', hint: 'American · calm' },
  { id: 'bf_emma', label: 'Emma', hint: 'British' },
  { id: 'bm_george', label: 'George', hint: 'British' },
];

export default function Settings() {
  const { profile, saveProfile, userId } = useStore();
  const [notify, setNotify] = useState(false);
  const [name, setName] = useState(profile.display_name ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const local = localTimeFor(NOTIFY_HOUR);

  useEffect(() => {
    notificationsEnabled().then(setNotify);
  }, []);

  const toggleNotify = async (on: boolean) => {
    if (on) {
      const ok = await requestNotifications();
      setNotify(ok);
      if (!ok) setMsg('Notifications are blocked. Turn them on for Expo Go / easymarket in iOS Settings.');
    } else {
      await disableNotifications();
      setNotify(false);
    }
  };

  return (
    <Screen padBottom={60}>
      {msg ? <Banner tone="warn" text={msg} /> : null}
      <SectionTitle>You</SectionTitle>
      <Card>
        <Text style={type.small}>Name used in your intro</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => saveProfile({ display_name: name.trim() || null })}
          placeholder="Optional"
          placeholderTextColor={colors.inkFaint}
          style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink, paddingVertical: 4 }}
        />
      </Card>

      <SectionTitle>Host voice</SectionTitle>
      <View style={{ gap: space.sm }}>
        {VOICES.map((v) => {
          const on = profile.voice === v.id;
          return (
            <Pressable key={v.id} onPress={() => saveProfile({ voice: v.id })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.accent : colors.border, borderWidth: 1.5, borderRadius: radius.md, padding: space.md }}>
              <View>
                <Text style={type.bodyStrong}>{v.label}</Text>
                <Text style={type.small}>{v.hint}</Text>
              </View>
              {on ? <Text style={{ fontFamily: font.bold, color: colors.accentInk }}>Selected</Text> : null}
            </Pressable>
          );
        })}
        <Text style={type.small}>Voice changes apply from your next episode.</Text>
      </View>

      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.bodyStrong}>Daily “episode ready” nudge</Text>
            <Text style={type.small}>
              7:00am Eastern{local.hour !== NOTIFY_HOUR || local.minute ? ` (${local.hour}:${String(local.minute).padStart(2, '0')} your time)` : ''}
            </Text>
          </View>
          <Switch value={notify} onValueChange={toggleNotify} trackColor={{ true: colors.accent }} />
        </View>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <Text style={type.small}>
          Facts come from official data (FRED, ECB) and public news feeds, linked in every episode's sources. Analysis is AI-generated and can be wrong. Nothing in easymarket is financial advice.
        </Text>
        <Text style={[type.small, { color: colors.inkFaint, fontSize: 11 }]} selectable>Account ID: {userId ?? 'offline'}</Text>
      </Card>
    </Screen>
  );
}
