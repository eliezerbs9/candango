/**
 * Activities tab. Two segments: **Open** (incomplete only — completed ones drop
 * off) and **All** (everything, searchable). Tap a card to edit; ＋ to create;
 * the check marks it done.
 */
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

import { ActivityFormModal } from '@/components/ActivityFormModal';
import { useActivities, useCompleteActivity } from '@/lib/api/activities';
import type { ActivityType, ApiActivity } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPE_EMOJI: Record<ActivityType, string> = {
  call: '📞',
  meeting: '🗓️',
  task: '✅',
  email: '✉️',
};

type Tab = 'open' | 'all';

export default function ActivitiesScreen() {
  const activities = useActivities();
  const complete = useCompleteActivity();
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApiActivity | null>(null);

  const data = useMemo(() => {
    let list = activities.data ?? [];
    if (tab === 'open') list = list.filter((a) => !a.done);
    const t = search.trim().toLowerCase();
    if (t) list = list.filter((a) => a.subject.toLowerCase().includes(t) || a.type.toLowerCase().includes(t));
    return list;
  }, [activities.data, tab, search]);

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
      </View>

      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, data.length === 0 && styles.grow]}
        refreshControl={
          <RefreshControl refreshing={activities.isRefetching} onRefresh={() => activities.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          activities.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.muted}>
                {search ? 'No matches.' : tab === 'open' ? 'No open activities.' : 'No activities yet.'}
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
              disabled={item.done || complete.isPending}
              onPress={() => complete.mutate(item.id)}
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
