/**
 * Settings → Billing (READ-ONLY). Mirrors the data on
 * apps/web/app/(app)/settings/billing/page.tsx — plan/status, seats, monthly
 * total and invoices — but per Apple's IAP rules the mobile app shows NO
 * subscribe/upgrade/checkout controls and takes no payment. Plan changes are
 * managed on the web (link-out note below). Invoices open in the browser.
 */
import { Stack } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  trialing: { bg: colors.infoTint, fg: colors.info },
  active: { bg: colors.successTint, fg: colors.success },
  past_due: { bg: colors.dangerTint, fg: colors.danger },
  canceled: { bg: colors.surface, fg: colors.textMuted },
  locked: { bg: colors.dangerTint, fg: colors.danger },
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export default function BillingScreen() {
  const { data: b, isLoading } = useBilling();

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Billing')} />
      {isLoading || !b ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          {b.locked ? (
            <View style={styles.alert}>
              <Icon name="warning" size={18} color={colors.danger} />
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>Workspace locked</Text>
                <Text style={styles.alertBody}>
                  Your trial ended without an active subscription. Add a payment method on the web to restore access.
                </Text>
              </View>
            </View>
          ) : null}

          <Card style={styles.summaryCard}>
            <Text style={styles.metaLabel}>Plan</Text>
            <View style={styles.planRow}>
              <Text style={styles.planName}>Per seat</Text>
              <View style={[styles.badge, { backgroundColor: (STATUS_TONE[b.status] ?? STATUS_TONE.canceled).bg }]}>
                <Text style={[styles.badgeText, { color: (STATUS_TONE[b.status] ?? STATUS_TONE.canceled).fg }]}>
                  {b.status}
                </Text>
              </View>
            </View>
            <Text style={styles.metaSub}>
              {b.status === 'trialing'
                ? `Trial ends in ${b.trialDaysLeft} day${b.trialDaysLeft === 1 ? '' : 's'}`
                : b.currentPeriodEnd
                  ? `Renews ${new Date(b.currentPeriodEnd).toLocaleDateString()}`
                  : '—'}
            </Text>
          </Card>

          <View style={styles.statRow}>
            <Card style={styles.statCard}>
              <Text style={styles.metaLabel}>Active seats</Text>
              <Text style={styles.statBig}>{b.seats}</Text>
              <Text style={styles.metaSub}>{money(b.pricePerSeat, b.currency)} / seat / mo</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.metaLabel}>{b.status === 'active' ? 'Next invoice' : 'Estimated monthly'}</Text>
              <Text style={styles.statBig}>{money(b.monthlyTotal, b.currency)}</Text>
            </Card>
          </View>

          <View style={styles.manageNote}>
            <Icon name="info" size={16} color={colors.textMuted} />
            <Text style={styles.manageText}>Manage your plan and payment method on the web app.</Text>
          </View>

          <Text style={styles.sectionTitle}>Invoices</Text>
          {b.invoices.length === 0 ? (
            <Text style={styles.dim}>No invoices yet.</Text>
          ) : (
            <View style={styles.card}>
              {b.invoices.map((inv, i) => (
                <View key={inv.id} style={[styles.invRow, i > 0 && styles.rowBorder]}>
                  <View style={styles.invText}>
                    <Text style={styles.invDate}>{new Date(inv.createdAt).toLocaleDateString()}</Text>
                    <Text style={styles.invAmount}>
                      {money(inv.amountPaid || inv.amountDue, inv.currency)} · {inv.status}
                    </Text>
                  </View>
                  {inv.hostedInvoiceUrl ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="View invoice"
                      hitSlop={8}
                      onPress={() => Linking.openURL(inv.hostedInvoiceUrl!)}
                      style={styles.viewLink}
                    >
                      <Text style={styles.viewText}>View</Text>
                      <Icon name="external" size={14} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  alert: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.dangerTint,
    borderRadius: radius.lg,
    padding: space.md,
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.danger },
  alertBody: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.danger },
  summaryCard: { gap: 4 },
  metaLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  planName: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, textTransform: 'capitalize' },
  metaSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: space.md },
  statCard: { flex: 1, gap: 4 },
  statBig: { fontFamily: fonts.display, fontSize: fontSize.h1, color: colors.ink, marginTop: 2 },
  manageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  manageText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  dim: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden' },
  invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  invText: { gap: 2 },
  invDate: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.ink },
  invAmount: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textTransform: 'capitalize' },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
});
