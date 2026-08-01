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

import { Icon } from '@/components/Icon';
import { Button, Card, Chip } from '@/components/ui';
import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeals, useStages } from '@/lib/api/deals';
import type { ApiDeal } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';
import { formatMoney } from '@/lib/format';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

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
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSubtle} />
          <TextInput
            style={styles.search}
            placeholder="Search deals…"
            placeholderTextColor={colors.textSubtle}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Chip label={item.label} on={filter === item.key} onPress={() => setFilter(item.key)} />
          )}
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
              <Button label="Retry" variant="secondary" icon="warning" onPress={() => deals.refetch()} />
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
            <Pressable
              onPress={() => router.push(`/deal/${item.id}`)}
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.value}>{formatMoney(item.value, item.currency)}</Text>
                </View>
                {sub ? (
                  <View style={styles.subRow}>
                    <Icon name="company" size={13} color={colors.textSubtle} />
                    <Text style={styles.sub} numberOfLines={1}>
                      {sub}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stageName.get(item.stageId) ?? 'Stage'}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/new-deal')}
        accessibilityRole="button"
        accessibilityLabel="New deal"
      >
        <Icon name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  filters: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  chips: { gap: space.sm, paddingRight: space.md },
  screen: { backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  list: { padding: space.md, gap: space.sm, backgroundColor: colors.surface },
  listEmpty: { flexGrow: 1 },
  card: { gap: space.xs + 2 },
  cardPressed: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink, flexShrink: 1 },
  value: { fontFamily: fonts.bold, fontSize: fontSize.md + 1, color: colors.ink },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, flexShrink: 1 },
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
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
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
    ...shadow.raised,
  },
  fabPressed: { opacity: 0.85 },
});
