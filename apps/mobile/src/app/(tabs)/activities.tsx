/**
 * Activities tab — list the org's activities (call/meeting/task/email), create
 * a new one, and mark done. Read + basic create (no date picker yet).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
          <RefreshControl refreshing={activities.isRefetching} onRefresh={() => activities.refetch()} />
        }
        ListEmptyComponent={
          activities.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
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
      <View style={styles.modalBackdrop}>
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
            placeholderTextColor="#a1a1aa"
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createText}>Create</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16, gap: 10 },
  grow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: '#a1a1aa' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    padding: 14,
  },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1, gap: 2 },
  subject: { fontSize: 15, fontWeight: '600', color: '#18181b' },
  done: { textDecorationLine: 'line-through', color: '#a1a1aa' },
  meta: { fontSize: 12, color: '#71717a', textTransform: 'capitalize' },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkMark: { color: '#d4d4d8', fontWeight: '800' },
  checkMarkDone: { color: '#fff' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#d9552c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '400' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#18181b' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  typeChipActive: { backgroundColor: '#fdf0ea', borderColor: '#d9552c' },
  typeChipText: { fontSize: 13, color: '#52525b', fontWeight: '500', textTransform: 'capitalize' },
  typeChipTextActive: { color: '#d9552c', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#18181b',
    backgroundColor: '#fafafa',
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { color: '#52525b', fontWeight: '600' },
  createBtn: {
    flex: 2,
    backgroundColor: '#d9552c',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createBtnOff: { opacity: 0.5 },
  createText: { color: '#fff', fontWeight: '700' },
});
