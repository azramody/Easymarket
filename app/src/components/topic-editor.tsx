import { Text, TextInput, View } from 'react-native';

import { Segmented } from '@/components/ui';
import { colors, font, radius, space, type } from '@/lib/theme';
import { DIFFICULTIES, FREQUENCIES, Topic, TopicPref, WEEKDAYS } from '@/lib/topics';

export function TopicEditor({ topic, pref, onChange, showNotes = true }: {
  topic: Topic; pref: TopicPref; onChange: (p: TopicPref) => void; showNotes?: boolean;
}) {
  const accent = { bg: topic.bg, fg: topic.fg };
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Depth</Text>
        <Segmented options={DIFFICULTIES} value={pref.difficulty} onChange={(difficulty) => onChange({ ...pref, difficulty })} accent={accent} />
        <Text style={type.small}>{DIFFICULTIES.find((d) => d.id === pref.difficulty)?.hint}</Text>
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>How often</Text>
        <Segmented options={FREQUENCIES} value={pref.frequency} onChange={(frequency) => onChange({ ...pref, frequency })} accent={accent} />
        {pref.frequency === 'weekly' ? (
          <>
            <Segmented options={WEEKDAYS.map((label, id) => ({ id, label }))} value={pref.weekly_day} onChange={(weekly_day) => onChange({ ...pref, weekly_day })} accent={accent} />
            <Text style={type.small}>Weekly topics get a longer recap of the past 7 days. On that day your episode becomes a ~30 min deep dive.</Text>
          </>
        ) : null}
      </View>
      {showNotes ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.caption}>Focus notes (optional)</Text>
          <TextInput
            value={pref.custom_notes}
            onChangeText={(custom_notes) => onChange({ ...pref, custom_notes })}
            placeholder={`e.g. "more on Japan and the yen, skip crypto"`}
            placeholderTextColor={colors.inkFaint}
            multiline
            style={{ minHeight: 80, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, fontFamily: font.regular, fontSize: 15, color: colors.ink, textAlignVertical: 'top' }}
          />
          <Text style={type.small}>Not sure what to write? Ask Lily to help you narrow it down.</Text>
        </View>
      ) : null}
    </View>
  );
}
