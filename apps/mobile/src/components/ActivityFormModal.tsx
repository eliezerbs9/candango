/**
 * Create an activity — mirrors the web ActivityForm. Type (Task/Call/Meeting/
 * Email) + Subject; Meeting uses start/end (+ location, meeting link), the rest
 * use a Due date. Optionally linked to a deal.
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
  { value: 'email', label: 'Email' },
];

function fmtDateTime(d: Date) {
  return `${formatDate(d.toISOString())}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

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
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [openPicker, setOpenPicker] = useState<null | 'deal'>(null);
  const [openDate, setOpenDate] = useState<null | 'due' | 'start' | 'end'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setType('task');
    setSubject('');
    setDealId(fixedDealId ?? null);
    setDueDate(null);
    setStartDate(null);
    setEndDate(null);
    setLocation('');
    setLink('');
    setOpenPicker(null);
    setOpenDate(null);
    setError(null);
  }, [visible, fixedDealId]);

  const isMeeting = type === 'meeting';
  const dealOptions: PickerOption[] = (deals.data ?? []).map((d) => ({ id: d.id, label: d.title }));
  const dealLabel = deals.data?.find((d) => d.id === dealId)?.title ?? (dealId ? 'Linked deal' : 'None');
  const canCreate = subject.trim().length > 0 && !create.isPending;

  async function submit() {
    setError(null);
    const body: ActivityBody = { type, subject: subject.trim(), dealId: dealId ?? undefined };
    if (isMeeting) {
      if (startDate) body.startAt = startDate.toISOString();
      if (endDate) body.endAt = endDate.toISOString();
      if (location.trim()) body.location = location.trim();
      if (link.trim()) body.conferenceUrl = link.trim();
    } else if (dueDate) {
      body.dueAt = dueDate.toISOString();
    }
    try {
      await create.mutateAsync(body);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the activity.');
    }
  }

  const onDateChange =
    (which: 'due' | 'start' | 'end') =>
    (_e: unknown, d?: Date) => {
      if (Platform.OS !== 'ios') setOpenDate(null);
      if (!d) return;
      if (which === 'due') setDueDate(d);
      else if (which === 'start') setStartDate(d);
      else setEndDate(d);
    };

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
                <Pressable style={styles.field} onPress={() => setOpenPicker('deal')}>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {dealLabel}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </>
            ) : null}

            {isMeeting ? (
              <>
                <DateField label="Start" value={startDate ? fmtDateTime(startDate) : 'Set…'} onPress={() => setOpenDate('start')} />
                {openDate === 'start' ? (
                  <DateTimePicker value={startDate ?? new Date()} mode="datetime" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange('start')} />
                ) : null}
                <DateField label="End" value={endDate ? fmtDateTime(endDate) : 'Set…'} onPress={() => setOpenDate('end')} />
                {openDate === 'end' ? (
                  <DateTimePicker value={endDate ?? startDate ?? new Date()} mode="datetime" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange('end')} />
                ) : null}
                <Text style={styles.label}>Location</Text>
                <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Address or place" placeholderTextColor={colors.textSubtle} />
                <Text style={styles.label}>Meeting link</Text>
                <TextInput style={styles.input} value={link} onChangeText={setLink} placeholder="https://…" placeholderTextColor={colors.textSubtle} autoCapitalize="none" autoCorrect={false} />
              </>
            ) : (
              <>
                <DateField label="Due date" value={dueDate ? formatDate(dueDate.toISOString()) : 'Set…'} onPress={() => setOpenDate('due')} onClear={dueDate ? () => setDueDate(null) : undefined} />
                {openDate === 'due' ? (
                  <DateTimePicker value={dueDate ?? new Date()} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange('due')} />
                ) : null}
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={openPicker === 'deal'}
        title="Deal"
        options={dealOptions}
        selectedId={dealId}
        allowClear
        onSelect={setDealId}
        onClose={() => setOpenPicker(null)}
      />
    </Modal>
  );
}

function DateField({ label, value, onPress, onClear }: { label: string; value: string; onPress: () => void; onClear?: () => void }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <Pressable style={[styles.field, { flex: 1 }]} onPress={onPress}>
          <Text style={styles.fieldValue}>{value}</Text>
        </Pressable>
        {onClear ? (
          <Pressable style={styles.clear} onPress={onClear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </>
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  typeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface },
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
