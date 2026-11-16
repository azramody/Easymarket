import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, shadow, space, type } from '@/lib/theme';

export function Screen({ children, scroll = true, padBottom = 140 }: { children: ReactNode; scroll?: boolean; padBottom?: number }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: padBottom, gap: space.xl }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return <View style={[styles.card, tint ? { backgroundColor: tint, borderColor: 'transparent' } : null, style]}>{children}</View>;
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, icon,
}: { label: string; onPress: () => void; variant?: 'primary' | 'soft' | 'ghost'; loading?: boolean; disabled?: boolean; icon?: ReactNode }) {
  const v = variantStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, v.box, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 }]}>
      {loading ? <ActivityIndicator color={v.text.color} /> : icon}
      <Text style={[styles.buttonText, v.text]}>{label}</Text>
    </Pressable>
  );
}

const variantStyles = {
  primary: { box: { backgroundColor: colors.ink }, text: { color: '#FFFFFF' } },
  soft: { box: { backgroundColor: colors.accentSoft }, text: { color: colors.accentInk } },
  ghost: { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }, text: { color: colors.ink } },
};

export function Segmented<T extends string | number>({
  options, value, onChange, accent,
}: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; accent?: { bg: string; fg: string } }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[styles.segmentItem, on && { backgroundColor: accent?.bg ?? colors.surface, ...shadow, shadowOpacity: 0.05 }]}>
            <Text style={[styles.segmentText, on && { color: accent?.fg ?? colors.ink, fontFamily: font.bold }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={type.caption}>{children}</Text>
      {right}
    </View>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  return (
    <Text style={[type.small, { color: colors.inkFaint, fontSize: 12, lineHeight: 17 }]}>
      {text ?? 'For information and education only — not financial advice. Facts come from the linked sources; analysis is AI-generated and can be wrong.'}
    </Text>
  );
}

export function Banner({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' }) {
  return (
    <View style={[styles.banner, tone === 'warn' && { backgroundColor: '#FBEBD8' }]}>
      <Text style={[type.small, { color: tone === 'warn' ? colors.warning : colors.accentInk }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.md },
  button: { flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: space.xl },
  buttonText: { fontFamily: font.bold, fontSize: 15 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  segmentText: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },
  banner: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.md },
});
