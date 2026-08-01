/**
 * Settings → Integrations. Mirrors apps/web/app/(app)/settings/integrations/page.tsx
 * (Google + QuickBooks cards with connection status). On mobile this is
 * read-only: it reflects the real connection status via the API, but the OAuth
 * connect/disconnect flow runs on the web (an intentional "manage on the web"
 * note), matching the web feature set without an in-app browser OAuth handoff.
 */
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useGoogleStatus } from '@/lib/api/integrations';
import { useQuickbooksStatus } from '@/lib/api/quickbooks';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

type Tone = 'on' | 'warn' | 'off';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  on: { bg: colors.successTint, fg: colors.success },
  warn: { bg: colors.primaryTint, fg: colors.primary },
  off: { bg: colors.surface, fg: colors.textMuted },
};

function StatusBadge({ tone, label, loading }: { tone: Tone; label: string; loading?: boolean }) {
  if (loading) return <Text style={styles.loadingBadge}>…</Text>;
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function IntegrationCard({
  icon,
  name,
  description,
  tone,
  label,
  loading,
}: {
  icon: IconName;
  name: string;
  description: string;
  tone: Tone;
  label: string;
  loading?: boolean;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.titleRow}>
          <Icon name={icon} size={20} color={colors.ink} />
          <Text style={styles.name}>{name}</Text>
        </View>
        <StatusBadge tone={tone} label={label} loading={loading} />
      </View>
      <Text style={styles.body}>{description}</Text>
    </Card>
  );
}

export default function IntegrationsScreen() {
  const google = useGoogleStatus();
  const qb = useQuickbooksStatus();

  const googleConnected = !!google.data?.connected;
  const qbConnected = !!qb.data?.connected;
  const qbReauth = qb.data?.status === 'reauth_required';

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Integrations')} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Optional integrations. The app works fully without them.</Text>

        <IntegrationCard
          icon="email"
          name="Google"
          description="Sync meetings with Google Calendar and capture email per salesperson."
          tone={googleConnected ? 'on' : 'off'}
          label={googleConnected ? 'Connected' : 'Not connected'}
          loading={google.isLoading}
        />

        <IntegrationCard
          icon="invoice"
          name="QuickBooks"
          description="Map deals to QuickBooks jobs; estimates set deal value, won deals create invoices."
          tone={qbConnected ? 'on' : qbReauth ? 'warn' : 'off'}
          label={qbConnected ? 'Connected' : qbReauth ? 'Reconnect needed' : 'Not connected'}
          loading={qb.isLoading}
        />

        <View style={styles.note}>
          <Icon name="info" size={16} color={colors.textMuted} />
          <Text style={styles.noteText}>
            Connecting or disconnecting an integration is done on the web app → Settings → Integrations. Once connected,
            it works here automatically.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.md },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  card: { gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs },
  loadingBadge: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textSubtle },
  note: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  noteText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, flex: 1, lineHeight: 19 },
});
