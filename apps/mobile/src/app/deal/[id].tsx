/**
 * Deal detail — core fields + move-stage. Tapping a stage chip PATCHes the
 * deal's stageId. Names are resolved from the stages/contacts caches.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeal, useMoveDeal, useStages } from '@/lib/api/deals';
import { formatDate, formatMoney } from '@/lib/format';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deal = useDeal(id);
  const stages = useStages();
  const persons = usePersons();
  const companies = useCompanies();
  const move = useMoveDeal();

  const pipelineStages = useMemo(
    () =>
      (stages.data ?? [])
        .filter((s) => s.pipelineId === deal.data?.pipelineId)
        .sort((a, b) => a.position - b.position),
    [stages.data, deal.data?.pipelineId],
  );

  const companyName = deal.data?.companyId
    ? companies.data?.find((c) => c.id === deal.data!.companyId)?.name
    : null;
  const personName = deal.data?.primaryPersonId
    ? persons.data?.find((p) => p.id === deal.data!.primaryPersonId)?.name
    : null;

  if (deal.isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Deal' }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (deal.isError || !deal.data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Deal' }} />
        <Text style={styles.errorTitle}>Couldn’t load this deal</Text>
        <Pressable style={styles.retry} onPress={() => deal.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const d = deal.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: d.title }} />

      <Text style={styles.title}>{d.title}</Text>
      <Text style={styles.value}>{formatMoney(d.value, d.currency)}</Text>
      <View style={[styles.statusPill, statusStyle(d.status)]}>
        <Text style={styles.statusText}>{d.status.toUpperCase()}</Text>
      </View>

      <Text style={styles.sectionLabel}>Stage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
        {pipelineStages.map((s) => {
          const active = s.id === d.stageId;
          const pending = move.isPending && move.variables?.stageId === s.id;
          return (
            <Pressable
              key={s.id}
              style={[styles.stageChip, active && styles.stageChipActive]}
              disabled={active || move.isPending}
              onPress={() => move.mutate({ id: d.id, stageId: s.id })}
            >
              {pending ? (
                <ActivityIndicator size="small" color="#d9552c" />
              ) : (
                <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>
                  {s.name}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        <Row label="Company" value={companyName ?? '—'} />
        <Row label="Primary contact" value={personName ?? '—'} />
        <Row label="Expected close" value={formatDate(d.expectedCloseDate)} />
        <Row label="Deal #" value={d.refNumber != null ? `#${d.refNumber}` : '—'} last />
      </View>
    </ScrollView>
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

function statusStyle(status: string) {
  if (status === 'won') return { backgroundColor: '#dcfce7' };
  if (status === 'lost') return { backgroundColor: '#fee2e2' };
  return { backgroundColor: '#e0e7ff' };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#18181b' },
  value: { fontSize: 20, fontWeight: '700', color: '#166534' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#3730a3' },
  sectionLabel: { fontSize: 13, color: '#71717a', marginTop: 16, marginBottom: 4 },
  stageRow: { gap: 8, paddingVertical: 2 },
  stageChip: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  stageChipActive: { backgroundColor: '#d9552c', borderColor: '#d9552c' },
  stageChipText: { fontSize: 13, color: '#52525b', fontWeight: '500' },
  stageChipTextActive: { color: '#fff', fontWeight: '700' },
  card: {
    marginTop: 20,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
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
  errorTitle: { fontSize: 16, fontWeight: '600', color: '#c0362c' },
  retry: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: '#2563eb', fontWeight: '600' },
});
