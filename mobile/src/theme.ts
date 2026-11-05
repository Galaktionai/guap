import type { TextStyle } from 'react-native';

// Tokens from the Figma file "Трекер финансов" (light theme).
export const colors = {
  bgBase: '#F4F5F7',
  surface: '#FFFFFF',
  muted: '#EEF0F3',
  textPrimary: '#0F1115',
  textSecondary: '#6B7280',
  textTertiary: '#A0A6B0',
  onAccent: '#FFFFFF',
  // #3C92EE is the brand accent; white text on it is only ~3.2:1, so
  // filled buttons with white labels use the darker accentStrong (~4.7:1).
  accent: '#3C92EE',
  accentStrong: '#2A74C8',
  accentSoft: '#E6F1FD',
  income: '#12A150',
  incomeSoft: '#E3F5EA',
  expense: '#E5484D',
  expenseSoft: '#FDECEC',
  border: '#E6E8EC',
  scrim: 'rgba(15, 17, 21, 0.45)',
} as const;

export const tints = {
  blue: { strong: '#3C92EE', soft: '#E6F1FD' },
  green: { strong: '#22A55B', soft: '#E2F5EA' },
  orange: { strong: '#E8890C', soft: '#FEF1DE' },
  teal: { strong: '#0E9F9E', soft: '#DDF4F3' },
  red: { strong: '#E5484D', soft: '#FDECEC' },
  yellow: { strong: '#D69E00', soft: '#FBF2D5' },
  pink: { strong: '#E2508F', soft: '#FCE7F0' },
  purple: { strong: '#8B5CF6', soft: '#F0EAFE' },
  indigo: { strong: '#5B61E8', soft: '#EBECFD' },
  gray: { strong: '#7A8290', soft: '#EEF0F3' },
} as const;

export type Tint = keyof typeof tints;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

// SF Pro is the iOS system font, so no custom font loading is needed.
export const typography = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: -0.6 },
  titleLarge: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.3 },
  titleMedium: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.1 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.1 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  tab: { fontSize: 11, lineHeight: 13, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
