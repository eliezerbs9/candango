/** Profile tab — signed-in user + workspace, API health, and sign out. */
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Card, SectionHeader } from '@/components/ui';
import { useHealth } from '@/lib/api/health';
import { useAuthStore } from '@/lib/auth/store';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data, isLoading, isError } = useHealth();
  const apiStatus = isLoading ? '…' : isError ? 'Offline' : (data?.status ?? 'OK');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Icon name="person" size={28} color={colors.textMuted} />
        </View>
        <Text style={styles.name}>{user?.name ?? user?.email ?? 'You'}</Text>
        <Text style={styles.org}>{user?.orgName}</Text>
      </View>

      <SectionHeader title="Account" />
      <Card style={styles.card}>
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Workspace" value={user?.orgName ?? '—'} />
        <Row label="Role" value={user?.role ?? '—'} />
        <Row label="API" value={apiStatus} tone={isError ? 'danger' : 'ok'} last />
      </Card>

      <View style={styles.flex} />

      <Button label="Sign out" variant="danger" icon="logout" onPress={signOut} fullWidth />
    </View>
  );
}

function Row({ label, value, last, tone }: { label: string; value: string; last?: boolean; tone?: 'ok' | 'danger' }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, tone === 'danger' && { color: colors.danger }, tone === 'ok' && { color: colors.success }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: space.lg, gap: space.sm },
  flex: { flex: 1 },
  header: { marginTop: space.sm, marginBottom: space.md, gap: 4, alignItems: 'flex-start' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  name: { fontFamily: fonts.display, fontSize: fontSize.h2, color: colors.ink },
  org: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.primary },
  card: { padding: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  rowValue: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.ink, flexShrink: 1 },
});
