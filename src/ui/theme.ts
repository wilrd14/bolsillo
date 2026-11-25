import type { ColorSchemeName, TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  readonly primary: string;
  readonly onPrimary: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly background: string;
  readonly text: string;
  readonly textMuted: string;
  readonly expense: string;
  readonly income: string;
  readonly warning: string;
  readonly danger: string;
  readonly onDanger: string;
  readonly border: string;
  readonly backdrop: string;
}

export interface TypographyTokens {
  readonly amountLarge: TextStyle;
  readonly title1: TextStyle;
  readonly title2: TextStyle;
  readonly body: TextStyle;
  readonly secondary: TextStyle;
  readonly label: TextStyle;
}

export interface SpacingTokens {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly xxl: number;
}

export interface RadiusTokens {
  readonly input: number;
  readonly card: number;
  readonly pill: number;
}

export interface Theme {
  readonly mode: ThemeMode;
  readonly colors: ColorTokens;
  readonly typography: TypographyTokens;
  readonly spacing: SpacingTokens;
  readonly radii: RadiusTokens;
  readonly cardElevation: ViewStyle;
}

export const MIN_TOUCH_TARGET = 44;
export const CAPTURE_BUTTON_SIZE = 56;
export const WCAG_NORMAL_TEXT_MIN = 4.5;

export const LIGHT_COLORS: ColorTokens = {
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#E5E7EB',
  background: '#F5F7F8',
  text: '#111827',
  textMuted: '#4B5563',
  expense: '#B91C1C',
  income: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  onDanger: '#FFFFFF',
  border: '#D1D5DB',
  backdrop: 'rgba(17, 24, 39, 0.5)',
};

export const DARK_COLORS: ColorTokens = {
  primary: '#2DD4BF',
  onPrimary: '#042F2E',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  background: '#0B1220',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  expense: '#F87171',
  income: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  onDanger: '#0B1220',
  border: '#374151',
  backdrop: 'rgba(0, 0, 0, 0.7)',
};

export const TYPOGRAPHY: TypographyTokens = {
  amountLarge: { fontSize: 40, fontWeight: '700', lineHeight: 48 },
  title1: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  title2: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  secondary: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
};

export const SPACING: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADII: RadiusTokens = {
  input: 8,
  card: 16,
  pill: 999,
};

const LIGHT_CARD_ELEVATION: ViewStyle = {
  shadowColor: '#111827',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};

// En oscuro el Brief §5.3 sustituye la sombra por un borde sutil.
const DARK_CARD_ELEVATION: ViewStyle = {
  borderWidth: 1,
  borderColor: DARK_COLORS.border,
};

export const LIGHT_THEME: Theme = {
  mode: 'light',
  colors: LIGHT_COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radii: RADII,
  cardElevation: LIGHT_CARD_ELEVATION,
};

export const DARK_THEME: Theme = {
  mode: 'dark',
  colors: DARK_COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radii: RADII,
  cardElevation: DARK_CARD_ELEVATION,
};

/** Resuelve el tema completo a partir del esquema de color del sistema o preferencia. */
export function getTheme(scheme?: ColorSchemeName | ThemeMode | null): Theme {
  return scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
