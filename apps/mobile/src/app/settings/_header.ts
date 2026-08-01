/**
 * Shared Stack.Screen header options for the Settings cluster, matching the
 * app style (see `headerOptions` in src/app/deal/[id].tsx and the integrations
 * screen). Returns a plain options object consumed by <Stack.Screen options=…>.
 */
import { colors, fonts } from '@/theme';

export function settingsHeaderOptions(title: string) {
  return {
    headerShown: true,
    title,
    headerStyle: { backgroundColor: colors.bg },
    headerShadowVisible: false,
    headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
    headerTintColor: colors.ink,
  } as const;
}
