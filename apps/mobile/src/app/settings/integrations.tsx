/**
 * Integrations settings — placeholder for now. Shows the QuickBooks connection
 * status; connecting/disconnecting is managed on the web (Settings → Integrations)
 * until the mobile OAuth flow is built.
 */
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useQuickbooksStatus } from '@/lib/api/quickbooks';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export default function IntegrationsScreen() {
  const qb = useQuickbooksStatus();
  const connected = !!qb.data?.connected;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Integrations',
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
          headerTintColor: colors.ink,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.name}>QuickBooks</Text>
            {qb.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={[styles.badge, connected ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeText, connected ? styles.badgeTextOn : styles.badgeTextOff]}>
                  {connected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.body}>
            Estimates &amp; invoices sync with QuickBooks when it's connected. Connecting/disconnecting is done on the
            web for now — go to the web app → Settings → Integrations. Once connected, it works here automatically.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: space.lg, gap: space.sm, backgroundColor: colors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeOn: { backgroundColor: colors.primaryTint },
  badgeOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs },
  badgeTextOn: { color: colors.success },
  badgeTextOff: { color: colors.textMuted },
  body: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
});
