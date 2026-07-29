/** Profile tab — signed-in user + workspace, API health, and sign out. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useHealth } from '@/lib/api/health';
import { useAuthStore } from '@/lib/auth/store';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data, isLoading, isError } = useHealth();
  const apiStatus = isLoading ? '…' : isError ? '✗ offline' : `✓ ${data?.status}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{user?.name ?? user?.email ?? 'You'}</Text>
        <Text style={styles.org}>{user?.orgName}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Workspace" value={user?.orgName ?? '—'} />
        <Row label="Role" value={user?.role ?? '—'} />
        <Row label="API" value={apiStatus} last />
      </View>

      <View style={styles.flex} />

      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  flex: { flex: 1 },
  header: { marginTop: space.sm, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: fontSize.h2, color: colors.ink },
  org: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
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
  logout: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontFamily: fonts.semibold, color: colors.danger, fontSize: fontSize.lg },
});
