/**
 * Deals tab — deals filtered by status (open/won/lost/archived) + client-side
 * search. Tap a deal to open its detail; the + button creates one.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeals, useStages } from '@/lib/api/deals';
import type { ApiDeal } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';
import { formatMoney } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type Filter = 'open' | 'won' | 'lost' | 'archived';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'archived', label: 'Archived' },
];

export default function DealsScreen() {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.orgName);
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');

  const deals = useDeals(filter === 'archived' ? { archived: true } : { status: filter });
  const stages = useStages();
  const persons = usePersons();
  const companies = useCompanies();

  const stageName = useMemo(() => new Map((stages.data ?? []).map((s) => [s.id, s.name])), [stages.data]);
  const personName = useMemo(() => new Map((persons.data ?? []).map((p) => [p.id, p.name])), [persons.data]);
  const companyName = useMemo(() => new Map((companies.data ?? []).map((c) => [c.id, c.name])), [companies.data]);

  function subtitle(deal: ApiDeal): string {
    const parts: string[] = [];
    if (deal.companyId && companyName.get(deal.companyId)) parts.push(companyName.get(deal.companyId)!);
    if (deal.primaryPersonId && personName.get(deal.primaryPersonId)) parts.push(personName.get(deal.primaryPersonId)!);
    return parts.join(' · ');
  }

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = deals.data ?? [];
    if (!t) return list;
    return list.filter((d) => d.title.toLowerCase().includes(t) || subtitle(d).toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals.data, search, companyName, personName]);

  return (
    <View style={styles.wrap}>
      <View style={styles.filters}>
        <TextInput
          style={styles.search}
          placeholder="Search deals…"
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const on = filter === item.key;
            return (
              <Pressable style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(item.key)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        style={styles.screen}
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={deals.isRefetching} onRefresh={() => deals.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          deals.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : deals.isError ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Couldn’t load deals</Text>
              <Pressable style={styles.retry} onPress={() => deals.refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>{search ? 'No matches' : `No ${filter} deals`}</Text>
              <Text style={styles.muted}>Workspace: {orgName ?? '—'}</Text>
            </View>
          )
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
  filters: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: space.sm },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  chips: { gap: space.sm, paddingRight: space.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.white },
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
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: colors.primary },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  retry: { marginTop: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  retryText: { fontFamily: fonts.semibold, color: colors.primary },
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
});
