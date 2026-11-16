// easymarket design tokens: soft neutral base, pastel topic colours, rounded and airy.
export const colors = {
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EDE8',
  border: '#E8E3DC',
  ink: '#25232C',
  inkSoft: '#5E5A68',
  inkFaint: '#9A96A3',
  accent: '#7B6CF0', // soft violet, used for primary actions
  accentSoft: '#ECE9FD',
  accentInk: '#4E3FC4',
  success: '#3C7A57',
  warning: '#A0612A',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  display: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  caption: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, color: colors.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};

export const shadow = {
  shadowColor: '#2B2540',
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};
