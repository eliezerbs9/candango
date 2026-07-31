/**
 * Activities tab. Two segments: **Open** (incomplete only — completed ones drop
 * off) and **All** (everything, searchable). The list is **server-paginated**:
 * "View more" fetches the next page (ordered by due date, filtered/searched on
 * the server) so we don't download everything at once. Tap a card to edit; ＋ to
 * create; the check marks it done (with a remove animation).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

import { ActivityFormModal } from '@/components/ActivityFormModal';
import { useActivitiesInfinite, useCompleteActivity } from '@/lib/api/activities';
import type { ActivityType, ApiActivity } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPE_EMOJI: Record<ActivityType, string> = {
  call: '📞',
  meeting: '🗓️',
  task: '✅',
  email: '✉️',
};

// Android needs this opt-in for LayoutAnimation (iOS is on by default).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tab = 'open' | 'all';
type ViewMode = 'list' | 'agenda';
type Period = 'any' | 'overdue' | 'upcoming' | 'week';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'any', label: 'Any time' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'week', label: 'This week' },
];

// Agenda buckets, in display order. Which one an activity falls in depends on
// its effective date (a meeting's start, else the due date).
const BUCKET_ORDER = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No date'] as const;
type Ref = { today: number; tomorrow: number; dayAfter: number; weekEnd: number };
function bucketOf(a: ApiActivity, ref: Ref): (typeof BUCKET_ORDER)[number] {
  const raw = a.startAt ?? a.dueAt;
  if (!raw) return 'No date';
  const t = new Date(raw).getTime();
  if (t < ref.today) return 'Overdue';
  if (t < ref.tomorrow) return 'Today';
  if (t < ref.dayAfter) return 'Tomorrow';
  if (t < ref.weekEnd) return 'This week';
  return 'Later';
}

export default function ActivitiesScreen() {
  const [tab, setTab] = useState<Tab>('open');
  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [period, setPeriod] = useState<Period>('any');
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApiActivity | null>(null);
  // Items the user just completed — hidden immediately (with a layout animation)
  // until the refetch confirms them as done.
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Debounce the search so we don't hit the server on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const range = useMemo<{ from?: string; to?: string }>(() => {
    const now = new Date();
    if (period === 'overdue') return { to: now.toISOString() };
    if (period === 'upcoming') return { from: now.toISOString() };
    if (period === 'week') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(now.getDate() - now.getDay()); // back to Sunday
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    return {};
  }, [period]);

  const activities = useActivitiesInfinite({
    done: tab === 'open' ? false : undefined,
    q: debounced || undefined,
    assignee: mine ? 'me' : undefined,
    from: range.from,
    to: range.to,
  });
  const complete = useCompleteActivity();

  const items = useMemo(() => {
    const all = activities.data?.pages.flat() ?? [];
    return tab === 'open' ? all.filter((a) => !completedIds.has(a.id)) : all;
  }, [activities.data, tab, completedIds]);

  // List mode = one unlabelled section; Agenda = grouped by date bucket. Items
  // are already sorted by due date, so buckets come out in order.
  const sections = useMemo(() => {
    if (items.length === 0) return [];
    if (view === 'list') return [{ title: '', data: items }];
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (7 - now.getDay())); // upcoming Sunday 00:00
    const ref: Ref = { today: today.getTime(), tomorrow: tomorrow.getTime(), dayAfter: dayAfter.getTime(), weekEnd: weekEnd.getTime() };
    const buckets: Record<string, ApiActivity[]> = {};
    for (const a of items) (buckets[bucketOf(a, ref)] ??= []).push(a);
    return BUCKET_ORDER.filter((o) => buckets[o]?.length).map((o) => ({ title: o, data: buckets[o] }));
  }, [items, view]);

  const completeActivity = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCompletedIds((prev) => new Set(prev).add(id));
    complete.mutate(id, {
      onError: () =>
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.segment}>
          <Segment label="Open" active={tab === 'open'} onPress={() => setTab('open')} />
          <Segment label="All" active={tab === 'all'} onPress={() => setTab('all')} />
        </View>
        <TextInput
          style={styles.search}
          placeholder={tab === 'all' ? 'Search all activities…' : 'Search open activities…'}
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, view === 'list' && styles.chipOn]} onPress={() => setView('list')}>
            <Text style={[styles.chipText, view === 'list' && styles.chipTextOn]}>☰ List</Text>
          </Pressable>
          <Pressable style={[styles.chip, view === 'agenda' && styles.chipOn]} onPress={() => setView('agenda')}>
            <Text style={[styles.chipText, view === 'agenda' && styles.chipTextOn]}>🗓 Agenda</Text>
          </Pressable>
          <View style={styles.chipDivider} />
          {PERIODS.map((p) => {
            const on = period === p.key;
            return (
              <Pressable key={p.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setPeriod(p.key)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          <Pressable style={[styles.chip, mine && styles.chipOn]} onPress={() => setMine((m) => !m)}>
            <Text style={[styles.chipText, mine && styles.chipTextOn]}>Mine</Text>
          </Pressable>
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.list, sections.length === 0 && styles.grow]}
        refreshControl={
          <RefreshControl refreshing={activities.isRefetching} onRefresh={() => activities.refetch()} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.5}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
        }
        ListFooterComponent={
          activities.hasNextPage ? (
            <Pressable
              style={styles.viewMore}
              onPress={() => activities.fetchNextPage()}
              disabled={activities.isFetchingNextPage}
            >
              {activities.isFetchingNextPage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.viewMoreText}>View more</Text>
              )}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          activities.isPending ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.muted}>
                {debounced || period !== 'any' || mine
                  ? 'No activities match.'
                  : tab === 'open'
                    ? 'No open activities.'
                    : 'No activities yet.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setEditing(item)}>
            <Text style={styles.emoji}>{TYPE_EMOJI[item.type]}</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.subject, item.done && styles.done]} numberOfLines={2}>
                {item.subject}
              </Text>
              <Text style={styles.meta}>
                {item.type} · {formatDate(item.startAt ?? item.dueAt)}
              </Text>
            </View>
            <Pressable
              style={[styles.check, item.done && styles.checkDone]}
              disabled={item.done}
              onPress={() => completeActivity(item.id)}
            >
              <Text style={[styles.checkMark, item.done && styles.checkMarkDone]}>✓</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setCreating(true)}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <ActivityFormModal
        visible={creating || !!editing}
        activity={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segBtn, active && styles.segBtnActive]} onPress={onPress}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { padding: space.md, paddingBottom: space.sm, gap: space.sm },
  segment: { flexDirection: 'row', gap: space.sm },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textMuted },
  segTextActive: { color: colors.white },
  chips: { gap: space.sm, alignItems: 'center', paddingRight: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.white },
  chipDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border, marginHorizontal: 2 },
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
  list: { padding: space.md, gap: 10 },
  grow: { flexGrow: 1 },
  sectionHeader: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: space.sm, marginBottom: 2 },
  viewMore: { alignSelf: 'center', marginTop: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  viewMoreText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSubtle },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1, gap: 2 },
  subject: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  done: { textDecorationLine: 'line-through', color: colors.textSubtle },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'capitalize' },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: colors.borderStrong, fontFamily: fonts.bold },
  checkMarkDone: { color: colors.white },
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
