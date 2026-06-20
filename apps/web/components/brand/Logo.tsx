import { Text } from '@mantine/core';

/**
 * Candango wordmark — "Candango" in Bricolage Grotesque with the "C" in the
 * brand terracotta. The rest inherits the current text color (adapts to
 * light/dark). Crisp at any size; no image asset needed.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <Text
      component="span"
      fz={size}
      fw={800}
      style={{
        fontFamily: "'Bricolage Grotesque', Inter, sans-serif",
        letterSpacing: '-0.035em',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      <span style={{ color: 'var(--mantine-color-candango-6)' }}>C</span>
      <span>andango</span>
    </Text>
  );
}
