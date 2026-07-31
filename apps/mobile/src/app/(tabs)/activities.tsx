/**
 * Activities tab. Two segments: **Open** (incomplete only — completed ones drop
 * off) and **All** (everything, searchable). The list is **server-paginated**:
 * "View more" fetches the next page (ordered by due date, filtered/searched on
 * the server) so we don't download everything at once. Tap a card to edit; ＋ to
 * create; the check marks it done (with a remove animation).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Icon, type IconName } from '@/components/Icon';
import { Chip } from '@/components/ui';
import { useActivitiesInfinite, useCompleteActivity } from '@/lib/api/activities';
import type { ActivityType, ApiActivity } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

const TYPE_ICON: Record<ActivityType, IconName> = {
  call: 'phone',
  meeting: 'meeting',
  task: 'task',
  email: 'email',
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
const AGENDA_GROUP_CAP = 10; // items shown per agenda group before "Show all"
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
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const listRef = useRef<SectionList<ApiActivity>>(null);
  const pendingJump = useRef<number | null>(null);

  const scrollToSection = (sectionIndex: number) => {
    pendingJump.current = sectionIndex;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
  };

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
    if (view === 'list') return [{ title: '', data: items, total: items.length }];
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
    // Cap each group at 10 (expandable) so a busy agenda stays navigable.
    return BUCKET_ORDER.filter((o) => buckets[o]?.length).map((o) => {
      const all = buckets[o];
      const data = expandedBuckets.has(o) ? all : all.slice(0, AGENDA_GROUP_CAP);
      return { title: o, data, total: all.length };
    });
  }, [items, view, expandedBuckets]);

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
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSubtle} />
          <TextInput
            style={styles.search}
            placeholder={tab === 'all' ? 'Search all activities…' : 'Search open activities…'}
            placeholderTextColor={colors.textSubtle}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="List" on={view === 'list'} onPress={() => setView('list')} />
          <Chip label="Agenda" on={view === 'agenda'} onPress={() => setView('agenda')} />
          <View style={styles.chipDivider} />
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} on={period === p.key} onPress={() => setPeriod(p.key)} />
          ))}
          <View style={styles.chipDivider} />
          <Chip label="Mine" on={mine} onPress={() => setMine((m) => !m)} />
        </ScrollView>

        {view === 'agenda' && sections.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jumpNav}>
            <Text style={styles.jumpLabel}>Jump to</Text>
            {sections.map((s, i) => (
              <Pressable key={s.title} style={styles.jumpChip} onPress={() => scrollToSection(i)}>
                <Text style={styles.jumpChipText}>
                  {s.title} ({s.total})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={view === 'agenda'}
        contentContainerStyle={[styles.list, sections.length === 0 && styles.grow]}
        refreshControl={
          <RefreshControl refreshing={activities.isRefetching} onRefresh={() => activities.refetch()} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={() => {
          const i = pendingJump.current;
          if (i == null) return;
          setTimeout(() => {
            listRef.current?.scrollToLocation({ sectionIndex: i, itemIndex: 0, viewPosition: 0, animated: true });
            pendingJump.current = null;
          }, 120);
        }}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text style={[styles.sectionHeader, view === 'agenda' && styles.sectionHeaderSticky]}>{section.title}</Text>
          ) : null
        }
        renderSectionFooter={({ section }) =>
          view === 'agenda' && section.total > section.data.length ? (
            <Pressable
              style={styles.showAll}
              onPress={() => setExpandedBuckets((prev) => new Set(prev).add(section.title))}
            >
              <Text style={styles.showAllText}>Show all {section.total}</Text>
            </Pressable>
          ) : null
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
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => setEditing(item)}
          >
            <View style={styles.typeBadge}>
              <Icon name={TYPE_ICON[item.type]} size={18} color={colors.textMuted} />
            </View>
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
              accessibilityRole="button"
              accessibilityLabel={item.done ? 'Completed' : 'Mark done'}
              hitSlop={8}
            >
              <Icon name="check" size={16} color={item.done ? colors.white : colors.borderStrong} />
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setCreating(true)}
        accessibilityRole="button"
        accessibilityLabel="New activity"
      >
        <Icon name="add" size={28} color={colors.white} />
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
  screen: { flex: 1, backgroundColor: colors.surface },
  top: {
    padding: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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
  segBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textMuted },
  segTextActive: { color: colors.white },
  chips: { gap: space.sm, alignItems: 'center', paddingRight: space.sm },
  chipDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.borderStrong, marginHorizontal: 2 },
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
  list: { padding: space.md, gap: space.sm },
  grow: { flexGrow: 1 },
  sectionHeader: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.sm, marginBottom: 2 },
  sectionHeaderSticky: { backgroundColor: colors.surface, paddingVertical: 6, marginTop: 0 },
  jumpNav: { gap: space.sm, alignItems: 'center', paddingRight: space.sm, paddingTop: space.xs },
  jumpLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  jumpChip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.primaryTint },
  jumpChipText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: colors.primary },
  showAll: { alignSelf: 'flex-start', paddingVertical: space.xs + 2, paddingHorizontal: 2 },
  showAllText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  viewMore: { alignSelf: 'center', marginTop: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.bg },
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
    ...shadow.card,
  },
  cardPressed: { opacity: 0.6 },
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
