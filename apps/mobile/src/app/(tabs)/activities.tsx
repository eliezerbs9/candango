/**
 * Activities tab — list the org's activities, create a new one, and mark done.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActivities, useCompleteActivity, useCreateActivity } from '@/lib/api/activities';
import type { ActivityType } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPE_EMOJI: Record<ActivityType, string> = {
  call: '📞',
  meeting: '🗓️',
  task: '✅',
  email: '✉️',
};

const CREATABLE: ActivityType[] = ['task', 'call', 'meeting'];

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
          <RefreshControl
            refreshing={activities.isRefetching}
            onRefresh={() => activities.refetch()}
            tintColor={colors.primary}
          />
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

      <CreateActivityModal visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

function CreateActivityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const create = useCreateActivity();

  async function submit() {
    if (!subject.trim()) return;
    await create.mutateAsync({ type, subject: subject.trim() });
    setSubject('');
    setType('task');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.sheetTitle}>New activity</Text>

          <View style={styles.typeRow}>
            {CREATABLE.map((t) => (
              <Pressable
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                  {TYPE_EMOJI[t]} {t}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor={colors.textSubtle}
            value={subject}
            onChangeText={setSubject}
            autoFocus
          />

          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.createBtn, (!subject.trim() || create.isPending) && styles.createBtnOff]}
              disabled={!subject.trim() || create.isPending}
              onPress={submit}
            >
              {create.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.createText}>Create</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.lg,
    gap: 14,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  typeChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, textTransform: 'capitalize' },
  typeChipTextActive: { fontFamily: fonts.bold, color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: space.xs },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.semibold, color: colors.textMuted },
  createBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createBtnOff: { opacity: 0.5 },
  createText: { fontFamily: fonts.bold, color: colors.white },
});
