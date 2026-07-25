/** Profile tab — signed-in user + workspace, API health, and sign out. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useHealth } from '@/lib/api/health';
import { useAuthStore } from '@/lib/auth/store';

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
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16 },
  flex: { flex: 1 },
  header: { marginTop: 8, gap: 2 },
  name: { fontSize: 26, fontWeight: '700', color: '#18181b' },
  org: { fontSize: 15, color: '#d9552c', fontWeight: '500' },
  card: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececee',
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, color: '#71717a' },
  rowValue: { fontSize: 14, color: '#18181b', fontWeight: '500', flexShrink: 1 },
  logout: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#c0362c', fontSize: 15, fontWeight: '600' },
});
