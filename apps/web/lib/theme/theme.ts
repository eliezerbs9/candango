import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Candango brand palette — terracotta "terra" (red earth of the Cerrado).
// Brand color #d9552c (the "C" / app icon). Lighter shade used on dark backgrounds.
const candango: MantineColorsTuple = [
  '#fff1ea', // 0
  '#f8ddd1', // 1
  '#eeb89f', // 2
  '#e4926d', // 3
  '#dc7243', // 4  (≈ inverted/dark-mode orange)
  '#d75e2a', // 5
  '#d9552c', // 6  ← brand
  '#c14a22', // 7
  '#a83f1c', // 8
  '#8a3214', // 9
];

export const theme = createTheme({
  primaryColor: 'candango',
  primaryShade: { light: 6, dark: 4 },
  colors: { candango },
  black: '#1c1a17', // warm dark ink from the brand
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontFamilyMonospace: "'Space Mono', ui-monospace, monospace",
  headings: {
    fontFamily: "'Bricolage Grotesque', Inter, sans-serif",
    fontWeight: '700',
  },
});
