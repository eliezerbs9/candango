/**
 * Design tokens — mirror of apps/web/lib/theme/theme.ts so the mobile app
 * matches the web look. Fonts: Bricolage Grotesque (display), Inter (UI/body),
 * Space Mono (mono). Custom fonts don't synthesize weight in React Native, so
 * each weight is its own family — use the `fonts` map, not `fontWeight`.
 */

export const colors = {
  // Brand — Candango terracotta scale
  primary: '#d9552c', // candango.6 (light primary)
  primaryDark: '#c14a22', // candango.7 (pressed)
  primaryTint: '#fff1ea', // candango.0 (active nav / soft fills)

  // Ink & neutrals
  ink: '#1c1a17', // warm near-black (web `black`)
  text: '#1c1a17',
  textMuted: '#71717a',
  textSubtle: '#a1a1aa',

  // Surfaces
  bg: '#ffffff',
  surface: '#fafafa',
  border: '#e6e3dd', // warm hairline border
  borderStrong: '#d9d5cd',

  // Semantic
  success: '#16a34a',
  successTint: '#dcfce7',
  danger: '#c0362c',
  dangerTint: '#fee2e2',
  info: '#3730a3',
  infoTint: '#e0e7ff',

  white: '#ffffff',
} as const;

/** Font family names as loaded by @expo-google-fonts (see _layout useFonts). */
export const fonts = {
  display: 'BricolageGrotesque_700Bold', // big titles / wordmark
  displaySemi: 'BricolageGrotesque_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'SpaceMono_400Regular',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  h3: 20,
  h2: 24,
  h1: 30,
  display: 40,
} as const;
