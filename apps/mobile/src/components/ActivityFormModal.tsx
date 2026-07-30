/**
 * Create an activity. Type (Task/Call/Meeting) + Subject + Due date, optionally
 * linked to a deal. Kept simple — email is a separate button, not a type here.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { useCreateActivity } from '@/lib/api/activities';
import { useDeals } from '@/lib/api/deals';
import type { ActivityBody, ActivityType } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
];

export function ActivityFormModal({
  visible,
  dealId: fixedDealId,
  onClose,
}: {
  visible: boolean;
  dealId?: string;
  onClose: () => void;
}) {
  const create = useCreateActivity();
  const deals = useDeals({ status: 'open' });

  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [dealId, setDealId] = useState<string | null>(fixedDealId ?? null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dealPickerOpen, setDealPickerOpen] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setType('task');
    setSubject('');
    setDealId(fixedDealId ?? null);
    setDueDate(null);
    setDealPickerOpen(false);
    setShowDate(false);
    setError(null);
  }, [visible, fixedDealId]);

  const dealOptions: PickerOption[] = (deals.data ?? []).map((d) => ({ id: d.id, label: d.title }));
  const dealLabel = deals.data?.find((d) => d.id === dealId)?.title ?? (dealId ? 'Linked deal' : 'None');
  const canCreate = subject.trim().length > 0 && !create.isPending;

  async function submit() {
    setError(null);
    const body: ActivityBody = { type, subject: subject.trim(), dealId: dealId ?? undefined };
    if (dueDate) body.dueAt = dueDate.toISOString();
    try {
      await create.mutateAsync(body);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the activity.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>New activity</Text>
            <Pressable onPress={submit} hitSlop={10} disabled={!canCreate}>
              {create.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.create, !canCreate && { opacity: 0.4 }]}>Create</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.typeChip, type === t.value && styles.typeChipOn]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={[styles.typeText, type === t.value && styles.typeTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="What is it about?"
              placeholderTextColor={colors.textSubtle}
              autoFocus
            />

            {!fixedDealId ? (
              <>
                <Text style={styles.label}>Deal</Text>
                <Pressable style={styles.field} onPress={() => setDealPickerOpen(true)}>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {dealLabel}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </>
            ) : null}

            <Text style={styles.label}>Due date</Text>
            <View style={styles.dateRow}>
              <Pressable style={[styles.field, { flex: 1 }]} onPress={() => setShowDate((s) => !s)}>
                <Text style={styles.fieldValue}>{dueDate ? formatDate(dueDate.toISOString()) : 'Set…'}</Text>
              </Pressable>
              {dueDate ? (
                <Pressable style={styles.clear} onPress={() => setDueDate(null)}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            {showDate ? (
              <DateTimePicker
                value={dueDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_e, d) => {
                  if (Platform.OS !== 'ios') setShowDate(false);
                  if (d) setDueDate(d);
                }}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={dealPickerOpen}
        title="Deal"
        options={dealOptions}
        selectedId={dealId}
        allowClear
        onSelect={setDealId}
        onClose={() => setDealPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  cancel: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  create: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.xs + 2 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.sm + 2 },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 9, alignItems: 'center', backgroundColor: colors.surface },
  typeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  typeTextOn: { fontFamily: fonts.bold, color: colors.white },
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.surface,
  },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink, flexShrink: 1 },
  chevron: { fontFamily: fonts.regular, fontSize: 22, color: colors.textSubtle },
  dateRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  clear: { paddingHorizontal: 12, paddingVertical: 13 },
  clearText: { fontFamily: fonts.medium, color: colors.textMuted },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
});
