/**
 * Create/edit an activity — unified with the web ActivityForm: Type
 * (Task/Call/Meeting) + Subject + Deal + Assignee + Participants, then Meeting →
 * Start/End + Location (In person/Video/Phone) → Address/Meeting link, else a
 * required Due date. Email is NOT a type here (it's a separate compose button).
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { MultiPickerModal } from '@/components/MultiPickerModal';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { useCreateActivity, useUpdateActivity } from '@/lib/api/activities';
import { useCompanies, useCreatePerson, usePersons } from '@/lib/api/contacts';
import { useDeal, useDeals } from '@/lib/api/deals';
import { useOrgMembers } from '@/lib/api/org';
import type { ActivityBody, ActivityType, ApiActivity, LocationType } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';
import { formatDate } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
];

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'video', label: 'Video' },
  { value: 'phone', label: 'Phone' },
];

const fmtDateTime = (d: Date) =>
  `${formatDate(d.toISOString())} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Ask whether a newly-created person should also be linked to the deal's company. */
function confirmLinkToCompany(name: string, companyName: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Add to company?', `Also add ${name} as a contact of ${companyName}?`, [
      { text: "Don't link", style: 'cancel', onPress: () => resolve(false) },
      { text: 'Link', onPress: () => resolve(true) },
    ]);
  });
}

export function ActivityFormModal({
  visible,
  dealId: fixedDealId,
  activity,
  onClose,
}: {
  visible: boolean;
  dealId?: string;
  activity?: ApiActivity | null;
  onClose: () => void;
}) {
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const deals = useDeals({ status: 'open' });
  const members = useOrgMembers();
  const persons = usePersons();
  const companies = useCompanies();
  const createPerson = useCreatePerson();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const editing = !!activity;
  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [dealId, setDealId] = useState<string | null>(fixedDealId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date>(new Date()); // required — defaults to today
  const [startAt, setStartAt] = useState<Date>(new Date());
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [location, setLocation] = useState('');
  const [conferenceUrl, setConferenceUrl] = useState('');
  const [dealPickerOpen, setDealPickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [participantsPickerOpen, setParticipantsPickerOpen] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timed = type === 'meeting';

  useEffect(() => {
    if (!visible) return;
    setType((activity?.type as ActivityType) ?? 'task');
    setSubject(activity?.subject ?? '');
    setDealId(activity?.dealId ?? fixedDealId ?? null);
    setAssigneeId(activity?.assignedUserId ?? currentUserId ?? null);
    setParticipantIds(activity?.participants.map((p) => p.id) ?? []);
    setDueDate(activity?.dueAt ? new Date(activity.dueAt) : new Date());
    setStartAt(activity?.startAt ? new Date(activity.startAt) : new Date());
    setEndAt(activity?.endAt ? new Date(activity.endAt) : null);
    setLocationType(activity?.locationType && activity.locationType !== 'none' ? activity.locationType : 'in_person');
    setLocation(activity?.location ?? '');
    setConferenceUrl(activity?.conferenceUrl ?? '');
    setDealPickerOpen(false);
    setAssigneePickerOpen(false);
    setParticipantsPickerOpen(false);
    setShowDate(false);
    setShowStart(false);
    setShowEnd(false);
    setError(null);
  }, [visible, fixedDealId, activity, currentUserId]);

  const dealOptions: PickerOption[] = (deals.data ?? []).map((d) => ({ id: d.id, label: d.title }));
  const dealLabel = deals.data?.find((d) => d.id === dealId)?.title ?? (dealId ? 'Linked deal' : 'None');

  // Participants = the deal's people (its primary contact + everyone at the
  // deal's company) plus anyone already selected. New people are creatable inline.
  const selectedDeal = useDeal(dealId ?? '').data;
  const dealCompany = companies.data?.find((c) => c.id === selectedDeal?.companyId);
  const dealPersonIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedDeal?.primaryPersonId) ids.add(selectedDeal.primaryPersonId);
    dealCompany?.contacts.forEach((c) => ids.add(c.id));
    return ids;
  }, [selectedDeal?.primaryPersonId, dealCompany]);
  const personOptions: PickerOption[] = useMemo(() => {
    const ids = new Set<string>([...dealPersonIds, ...participantIds]);
    return [...ids].map((id) => {
      const p = persons.data?.find((x) => x.id === id);
      return { id, label: p?.name ?? 'Unknown', sub: [p?.email, p?.phone].filter(Boolean).join(' · ') || undefined };
    });
  }, [dealPersonIds, participantIds, persons.data]);
  const participantsLabel = participantIds.length
    ? participantIds.map((id) => persons.data?.find((p) => p.id === id)?.name ?? '?').join(', ')
    : dealId
      ? "The deal's people"
      : 'None';

  const memberOptions: PickerOption[] = (members.data ?? []).map((m) => ({
    id: m.id,
    label: m.name || m.email,
    sub: m.name ? m.email : undefined,
  }));
  const assigneeMember = members.data?.find((m) => m.id === assigneeId);
  const assigneeLabel = assigneeMember
    ? `${assigneeMember.name || assigneeMember.email}${assigneeId === currentUserId ? ' (me)' : ''}`
    : assigneeId === currentUserId
      ? 'Me'
      : 'Unassigned';

  const busy = create.isPending || update.isPending;
  const canCreate = subject.trim().length > 0 && !busy;

  async function submit() {
    setError(null);
    const body: ActivityBody = {
      type,
      subject: subject.trim(),
      dealId: dealId ?? undefined,
      assignedUserId: assigneeId ?? undefined,
      participantIds: participantIds.length ? participantIds : undefined,
    };
    if (timed) {
      body.startAt = startAt.toISOString();
      if (endAt) body.endAt = endAt.toISOString();
      body.locationType = locationType;
      if (locationType === 'in_person') body.location = location || undefined;
      if (locationType === 'video') body.conferenceUrl = conferenceUrl || undefined;
    } else {
      body.dueAt = dueDate.toISOString(); // required — no dateless activities
    }
    try {
      if (editing && activity) await update.mutateAsync({ id: activity.id, ...body });
      else await create.mutateAsync(body);
      showToast(editing ? 'Activity updated' : 'Activity created');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the activity.');
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
            <Text style={styles.title}>{editing ? 'Edit activity' : 'New activity'}</Text>
            <Pressable onPress={submit} hitSlop={10} disabled={!canCreate}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.create, !canCreate && { opacity: 0.4 }]}>{editing ? 'Save' : 'Create'}</Text>
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

            <Text style={styles.label}>Assignee</Text>
            <Pressable style={styles.field} onPress={() => setAssigneePickerOpen(true)}>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {assigneeLabel}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Text style={styles.label}>Participants</Text>
            <Pressable style={styles.field} onPress={() => setParticipantsPickerOpen(true)}>
              <Text style={[styles.fieldValue, !participantIds.length && styles.fieldMuted]} numberOfLines={1}>
                {participantsLabel}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            {timed ? (
              <>
                <Text style={styles.label}>Start</Text>
                <Pressable style={styles.field} onPress={() => setShowStart((s) => !s)}>
                  <Text style={styles.fieldValue}>{fmtDateTime(startAt)}</Text>
                </Pressable>
                {showStart ? (
                  <DateTimePicker
                    value={startAt}
                    mode="datetime"
                    display="default"
                    onChange={(_e, d) => {
                      if (Platform.OS !== 'ios') setShowStart(false);
                      if (d) setStartAt(d);
                    }}
                  />
                ) : null}

                <Text style={styles.label}>End</Text>
                <Pressable style={styles.field} onPress={() => setShowEnd((s) => !s)}>
                  <Text style={[styles.fieldValue, !endAt && styles.fieldMuted]}>
                    {endAt ? fmtDateTime(endAt) : 'Set…'}
                  </Text>
                </Pressable>
                {showEnd ? (
                  <DateTimePicker
                    value={endAt ?? startAt}
                    mode="datetime"
                    display="default"
                    onChange={(_e, d) => {
                      if (Platform.OS !== 'ios') setShowEnd(false);
                      if (d) setEndAt(d);
                    }}
                  />
                ) : null}

                <Text style={styles.label}>Location</Text>
                <View style={styles.typeRow}>
                  {LOCATION_TYPES.map((l) => (
                    <Pressable
                      key={l.value}
                      style={[styles.typeChip, locationType === l.value && styles.typeChipOn]}
                      onPress={() => setLocationType(l.value)}
                    >
                      <Text style={[styles.typeText, locationType === l.value && styles.typeTextOn]}>{l.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {locationType === 'in_person' ? (
                  <>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                      style={styles.input}
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Where you'll meet"
                      placeholderTextColor={colors.textSubtle}
                    />
                  </>
                ) : null}
                {locationType === 'video' ? (
                  <>
                    <Text style={styles.label}>Meeting link</Text>
                    <TextInput
                      style={styles.input}
                      value={conferenceUrl}
                      onChangeText={setConferenceUrl}
                      placeholder="https://…"
                      placeholderTextColor={colors.textSubtle}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.label}>Due date</Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="inline"
                    style={styles.inlinePicker}
                    onChange={(_e, d) => {
                      if (d) setDueDate(d);
                    }}
                  />
                ) : (
                  <>
                    <Pressable style={styles.field} onPress={() => setShowDate((s) => !s)}>
                      <Text style={styles.fieldValue}>{formatDate(dueDate.toISOString())}</Text>
                    </Pressable>
                    {showDate ? (
                      <DateTimePicker
                        value={dueDate}
                        mode="date"
                        display="default"
                        onChange={(_e, d) => {
                          setShowDate(false);
                          if (d) setDueDate(d);
                        }}
                      />
                    ) : null}
                  </>
                )}
              </>
            )}

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
      <PickerModal
        visible={assigneePickerOpen}
        title="Assignee"
        options={memberOptions}
        selectedId={assigneeId}
        onSelect={setAssigneeId}
        onClose={() => setAssigneePickerOpen(false)}
      />
      <MultiPickerModal
        visible={participantsPickerOpen}
        title="Participants"
        options={personOptions}
        selectedIds={participantIds}
        onChange={setParticipantIds}
        onCreate={async (name) => {
          const link = dealCompany ? await confirmLinkToCompany(name, dealCompany.name) : false;
          const p = await createPerson.mutateAsync({ name, companyIds: link ? [dealCompany!.id] : undefined });
          return p.id;
        }}
        onClose={() => setParticipantsPickerOpen(false)}
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
  fieldMuted: { color: colors.textSubtle },
  chevron: { fontFamily: fonts.regular, fontSize: 22, color: colors.textSubtle },
  inlinePicker: { alignSelf: 'flex-start', marginTop: space.xs },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
});
