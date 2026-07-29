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
import { colors, fonts, fontSize, radius, space } from '@/theme';

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
        <ActivityIndicator color={colors.primary} />
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
    <View style={styles.wrap}>
    <FlatList
      style={styles.screen}
      data={deals.data ?? []}
      keyExtractor={(d) => d.id}
      contentContainerStyle={[styles.list, (deals.data ?? []).length === 0 && styles.listEmpty]}
      refreshControl={
        <RefreshControl
          refreshing={deals.isRefetching}
          onRefresh={() => deals.refetch()}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No open deals</Text>
          <Text style={styles.muted}>Workspace: {orgName ?? '—'}</Text>
          <Text style={styles.mutedSmall}>Pull down to refresh, or tap the button below.</Text>
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
      <Pressable style={styles.fab} onPress={() => router.push('/deal/new')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: colors.white, fontSize: 30, lineHeight: 34 },
  screen: { backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.sm },
  list: { padding: space.md, gap: 10, backgroundColor: colors.bg },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.xs + 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink, flexShrink: 1 },
  value: { fontFamily: fonts.bold, fontSize: fontSize.md + 1, color: colors.success },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: colors.primary },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  mutedSmall: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSubtle, textAlign: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  errorTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.danger },
  retry: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  retryText: { fontFamily: fonts.semibold, color: colors.primary },
});
