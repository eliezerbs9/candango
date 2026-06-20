import { createTheme } from '@mantine/core';

/**
 * Base Candango theme. Tenant branding (primary color, logo) will be merged
 * over this at runtime via a `useBrandedTheme()` hook (see UI-0 docs).
 */
export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: '600',
  },
});
