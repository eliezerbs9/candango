/**
 * Deals tab — a list of open deals. Resolves stage / company / primary contact
 * names from the stages + contacts caches. Tap a deal to open its detail.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeals, useStages } from '@/lib/api/deals';
import type { ApiDeal } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';
import { formatMoney } from '@/lib/format';

export default function DealsScreen() {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.orgName);
  const deals = useDeals({ status: 'open' });
  const stages = useStages();
  const persons = usePersons();
  const companies = useCompanies();

  const stageName = useMemo(() => {
    const m = new Map<string, string>();
    stages.data?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [stages.data]);

  const personName = useMemo(() => {
    const m = new Map<string, string>();
    persons.data?.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [persons.data]);

  const companyName = useMemo(() => {
    const m = new Map<string, string>();
    companies.data?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies.data]);

  function subtitle(deal: ApiDeal): string {
    const parts: string[] = [];
    if (deal.companyId && companyName.get(deal.companyId)) parts.push(companyName.get(deal.companyId)!);
    if (deal.primaryPersonId && personName.get(deal.primaryPersonId)) {
      parts.push(personName.get(deal.primaryPersonId)!);
    }
    return parts.join(' · ');
  }

  if (deals.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (deals.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn’t load deals</Text>
        <Text style={styles.muted}>
          {deals.error instanceof Error ? deals.error.message : 'Unknown error'}
        </Text>
        <Pressable style={styles.retry} onPress={() => deals.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={deals.data ?? []}
      keyExtractor={(d) => d.id}
      contentContainerStyle={[styles.list, (deals.data ?? []).length === 0 && styles.listEmpty]}
      refreshControl={
        <RefreshControl refreshing={deals.isRefetching} onRefresh={() => deals.refetch()} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No open deals</Text>
          <Text style={styles.muted}>
            Workspace: {orgName ?? '—'}
          </Text>
          <Text style={styles.mutedSmall}>
            Pull down to refresh, or tap the button below.
          </Text>
          <Pressable style={styles.retry} onPress={() => deals.refetch()}>
            <Text style={styles.retryText}>{deals.isRefetching ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => {
        const sub = subtitle(item);
        return (
          <Pressable style={styles.card} onPress={() => router.push(`/deal/${item.id}`)}>
            <View style={styles.cardTop}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.value}>{formatMoney(item.value, item.currency)}</Text>
            </View>
            {sub ? (
              <Text style={styles.sub} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{stageName.get(item.stageId) ?? 'Stage'}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  list: { padding: 16, gap: 10 },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '600', color: '#18181b', flexShrink: 1 },
  value: { fontSize: 15, fontWeight: '700', color: '#166534' },
  sub: { fontSize: 13, color: '#71717a' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fdf0ea',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  badgeText: { fontSize: 12, color: '#d9552c', fontWeight: '600' },
  muted: { fontSize: 14, color: '#71717a' },
  mutedSmall: { fontSize: 13, color: '#a1a1aa', textAlign: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#18181b' },
  errorTitle: { fontSize: 16, fontWeight: '600', color: '#c0362c' },
  retry: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: '#2563eb', fontWeight: '600' },
});
