/**
 * Activities tab — list the org's activities (call/meeting/task/email), create
 * a new one (full form, matching the web), and mark done.
 */
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ActivityFormModal } from '@/components/ActivityFormModal';
import { useActivities, useCompleteActivity } from '@/lib/api/activities';
import type { ActivityType } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPE_EMOJI: Record<ActivityType, string> = {
  call: '📞',
  meeting: '🗓️',
  task: '✅',
  email: '✉️',
};

export default function ActivitiesScreen() {
  const activities = useActivities();
  const complete = useCompleteActivity();
  const [creating, setCreating] = useState(false);

  return (
    <View style={styles.screen}>
      <FlatList
        data={activities.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, (activities.data ?? []).length === 0 && styles.grow]}
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
              <Text style={styles.muted}>No activities yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
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
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setCreating(true)}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <ActivityFormModal visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
