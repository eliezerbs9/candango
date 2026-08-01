/**
 * Deal detail — core fields, move-stage, lifecycle actions (win/lose/reopen/
 * archive), and a timeline (notes + activities + stage history) with add-note.
 * Sections are grouped into white cards on a light surface; terracotta is the
 * accent (deal #, value, current stage, primary actions).
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
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

import { useQueryClient } from '@tanstack/react-query';

import { ActivityFormModal } from '@/components/ActivityFormModal';
import { ComposeEmailModal, type ComposeInitial } from '@/components/ComposeEmailModal';
import { EditDealModal } from '@/components/EditDealModal';
import { EmailViewModal } from '@/components/EmailViewModal';
import { Icon, type IconName } from '@/components/Icon';
import { QuickbooksPanel } from '@/components/QuickbooksPanel';
import { useActivity, useUpdateActivity } from '@/lib/api/activities';
import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeal, useDealLifecycle, useDealTimeline, useMoveDeal, useStages } from '@/lib/api/deals';
import { useCreateNote } from '@/lib/api/notes';
import { formatDate, formatMoney } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

const headerOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
};

type TItem =
  | { kind: 'note'; at: string; id: string; body: string; author: string }
  | { kind: 'activity'; at: string; id: string; atype: string; subject: string; done: boolean }
  | { kind: 'stage'; at: string; id: string; from: string | null; to: string }
  | { kind: 'email'; at: string; id: string; direction: 'in' | 'out'; subject: string; snippet: string | null; from: string; threadId: string | null };

const ACT_ICON: Record<string, IconName> = { call: 'phone', meeting: 'meeting', task: 'task', email: 'email' };

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deal = useDeal(id);
  const stages = useStages();
  const persons = usePersons();
  const companies = useCompanies();
  const move = useMoveDeal();
  const life = useDealLifecycle();
  const tl = useDealTimeline(id);
  const qc = useQueryClient();
  const refreshTimeline = () => qc.invalidateQueries({ queryKey: ['deal', id, 'timeline'] });
  const createNote = useCreateNote(id);
  const [noteText, setNoteText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [loseOpen, setLoseOpen] = useState(false);
  const [loseReason, setLoseReason] = useState('');
  const [compose, setCompose] = useState<{ open: boolean; initial?: ComposeInitial }>({ open: false });
  const [activityOpen, setActivityOpen] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  const editActivityQuery = useActivity(editActivityId);
  const [viewEmail, setViewEmail] = useState<Extract<TItem, { kind: 'email' }> | null>(null);
  const updateActivity = useUpdateActivity();

  const pipelineStages = useMemo(
    () =>
      (stages.data ?? [])
        .filter((s) => s.pipelineId === deal.data?.pipelineId)
        .sort((a, b) => a.position - b.position),
    [stages.data, deal.data?.pipelineId],
  );

  // Server-paginated timeline: flatten the loaded pages (already newest-first).
  const timeline = useMemo<TItem[]>(
    () =>
      (tl.data?.pages.flatMap((p) => p.items) ?? []).map((i) =>
        i.kind === 'email' ? { ...i, subject: i.subject ?? '(no subject)' } : i,
      ),
    [tl.data],
  );

  const companyName = deal.data?.companyId
    ? companies.data?.find((c) => c.id === deal.data!.companyId)?.name
    : null;
  const personName = deal.data?.primaryPersonId
    ? persons.data?.find((p) => p.id === deal.data!.primaryPersonId)?.name
    : null;

  if (deal.isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ ...headerOptions, title: 'Deal' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (deal.isError || !deal.data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ ...headerOptions, title: 'Deal' }} />
        <Text style={styles.errorTitle}>Couldn’t load this deal</Text>
        <Pressable style={styles.retry} onPress={() => deal.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const d = deal.data;
  const busy = life.win.isPending || life.lose.isPending || life.reopen.isPending || life.archive.isPending;
  const currentStage = pipelineStages.find((s) => s.id === d.stageId)?.name;
  const primaryPersonEmail = d.primaryPersonId
    ? persons.data?.find((p) => p.id === d.primaryPersonId)?.email ?? null
    : null;

  const openNewEmail = () =>
    setCompose({ open: true, initial: { to: primaryPersonEmail ? [primaryPersonEmail] : [] } });
  const openReply = (it: Extract<TItem, { kind: 'email' }>) =>
    setCompose({
      open: true,
      initial: {
        to: [it.from],
        subject: it.subject.startsWith('Re:') ? it.subject : `Re: ${it.subject}`,
        threadId: it.threadId ?? undefined,
        inReplyTo: it.id,
      },
    });

  async function addNote() {
    if (!noteText.trim()) return;
    await createNote.mutateAsync(noteText.trim());
    setNoteText('');
    refreshTimeline();
    showToast('Note added');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen
        options={{
          ...headerOptions,
          title: d.title,
          headerRight: () => (
            <Pressable onPress={() => setEditOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit deal">
              <Text style={styles.headerEdit}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      {/* Header — deal identity + value + status + lifecycle actions */}
      <View style={styles.headerCard}>
        {d.refNumber != null ? <Text style={styles.refNum}>DEAL #{d.refNumber}</Text> : null}
        <Text style={styles.title}>{d.title}</Text>
        <Text style={styles.value}>{formatMoney(d.value, d.currency)}</Text>
        <View style={styles.pillRow}>
          {currentStage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>{currentStage}</Text>
            </View>
          ) : null}
          <View style={[styles.statusPill, statusTint(d.status)]}>
            <Text style={[styles.statusText, statusInk(d.status)]}>{d.status.toUpperCase()}</Text>
          </View>
          {d.archivedAt ? (
            <View style={[styles.statusPill, styles.archivedPill]}>
              <Text style={[styles.statusText, { color: colors.textMuted }]}>ARCHIVED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {d.status === 'open' && !d.archivedAt ? (
            <>
              <ActionBtn label="Won" tone="success" busy={busy} onPress={() => life.win.mutate(d.id)} />
              <ActionBtn label="Lost" tone="danger" busy={busy} onPress={() => { setLoseReason(''); setLoseOpen(true); }} />
              <ActionBtn label="Archive" tone="neutral" busy={busy} onPress={() => life.archive.mutate(d.id)} />
            </>
          ) : (
            <ActionBtn label="Reopen" tone="primary" busy={busy} onPress={() => life.reopen.mutate(d.id)} />
          )}
        </View>
      </View>

      {/* Stage */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Stage</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
          {pipelineStages.map((s) => {
            const active = s.id === d.stageId;
            const pending = move.isPending && move.variables?.stageId === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.stageChip, active && styles.stageChipActive]}
                disabled={active || move.isPending}
                onPress={() => move.mutate({ id: d.id, stageId: s.id }, { onSuccess: refreshTimeline })}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>{s.name}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Details */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Details</Text>
        <View style={styles.rows}>
          <Row icon="company" label="Company" value={companyName ?? '—'} />
          <Row icon="person" label="Primary contact" value={personName ?? '—'} />
          <Row icon="activities" label="Expected close" value={formatDate(d.expectedCloseDate)} />
          <Row icon="info" label="Deal #" value={d.refNumber != null ? `#${d.refNumber}` : '—'} last />
        </View>
      </View>

      {/* Estimates & invoices */}
      <QuickbooksPanel dealId={d.id} dealTitle={d.title} currency={d.currency} qbSubcustomerId={d.qbSubcustomerId} />

      {/* Timeline */}
      <View style={styles.sectionCard}>
        <View style={styles.timelineHead}>
          <Text style={styles.sectionLabel}>Timeline</Text>
          <View style={styles.timelineBtns}>
            <Pressable style={styles.chipBtn} onPress={() => setActivityOpen(true)}>
              <Icon name="add" size={14} color={colors.primary} />
              <Text style={styles.chipBtnText}>Activity</Text>
            </Pressable>
            <Pressable style={styles.chipBtn} onPress={openNewEmail}>
              <Icon name="email" size={14} color={colors.primary} />
              <Text style={styles.chipBtnText}>Email</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.noteBox}>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note…"
            placeholderTextColor={colors.textSubtle}
            value={noteText}
            onChangeText={setNoteText}
            multiline
          />
          <Pressable
            style={[styles.noteBtn, (!noteText.trim() || createNote.isPending) && styles.noteBtnOff]}
            disabled={!noteText.trim() || createNote.isPending}
            onPress={addNote}
          >
            {createNote.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.noteBtnText}>Add</Text>
            )}
          </Pressable>
        </View>

        {tl.isPending ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: space.md }} />
        ) : timeline.length === 0 ? (
          <Text style={styles.emptyTimeline}>No activity yet.</Text>
        ) : (
          <>
            {timeline.map((it) => (
              <TimelineRow
                key={`${it.kind}-${it.id}`}
                item={it}
                onOpen={setViewEmail}
                onToggleActivity={(aid, done) =>
                  updateActivity.mutate({ id: aid, done }, { onSuccess: refreshTimeline })
                }
                onEditActivity={(aid) => setEditActivityId(aid)}
              />
            ))}
            {tl.hasNextPage ? (
              <Pressable style={styles.loadMore} onPress={() => tl.fetchNextPage()} disabled={tl.isFetchingNextPage}>
                {tl.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <View style={{ height: space.xl }} />

      <EditDealModal visible={editOpen} deal={d} onClose={() => setEditOpen(false)} />

      <ComposeEmailModal
        visible={compose.open}
        dealId={d.id}
        initial={compose.initial}
        onClose={() => {
          setCompose({ open: false });
          refreshTimeline();
        }}
      />

      <ActivityFormModal
        visible={activityOpen || !!editActivityQuery.data}
        dealId={d.id}
        activity={editActivityQuery.data ?? null}
        onClose={() => {
          setActivityOpen(false);
          setEditActivityId(null);
          refreshTimeline();
        }}
      />

      <EmailViewModal
        visible={!!viewEmail}
        email={
          viewEmail
            ? {
                id: viewEmail.id,
                subject: viewEmail.subject,
                from: viewEmail.from,
                direction: viewEmail.direction,
                at: viewEmail.at,
                snippet: viewEmail.snippet,
              }
            : null
        }
        onReply={() => {
          const e = viewEmail;
          setViewEmail(null);
          if (e) openReply(e);
        }}
        onClose={() => setViewEmail(null)}
      />

      <Modal visible={loseOpen} animationType="slide" transparent onRequestClose={() => setLoseOpen(false)}>
        <KeyboardAvoidingView style={styles.loseBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.loseSheet}>
            <Text style={styles.loseTitle}>Mark as lost</Text>
            <TextInput
              style={styles.loseInput}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textSubtle}
              value={loseReason}
              onChangeText={setLoseReason}
              multiline
              autoFocus
            />
            <View style={styles.loseActions}>
              <Pressable style={styles.loseCancel} onPress={() => setLoseOpen(false)}>
                <Text style={styles.loseCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.loseConfirm}
                onPress={() => {
                  life.lose.mutate({ id: d.id, lostReason: loseReason.trim() || undefined });
                  setLoseOpen(false);
                }}
              >
                <Text style={styles.loseConfirmText}>Mark lost</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function TimelineRow({
  item,
  onOpen,
  onToggleActivity,
  onEditActivity,
}: {
  item: TItem;
  onOpen: (it: Extract<TItem, { kind: 'email' }>) => void;
  onToggleActivity: (id: string, done: boolean) => void;
  onEditActivity: (id: string) => void;
}) {
  let icon: IconName = 'note';
  let text: ReactNode = null;
  if (item.kind === 'note') {
    icon = 'note';
    text = (
      <>
        <Text style={styles.tlText}>{item.body}</Text>
        <Text style={styles.tlMeta}>{item.author} · {formatDate(item.at)}</Text>
      </>
    );
  } else if (item.kind === 'activity') {
    icon = ACT_ICON[item.atype] ?? 'task';
    text = (
      <>
        <Text style={[styles.tlText, item.done && styles.tlDone]}>{item.subject}</Text>
        <Text style={styles.tlMeta}>{item.atype} · {formatDate(item.at)}</Text>
      </>
    );
  } else if (item.kind === 'stage') {
    icon = 'stage';
    text = (
      <>
        <Text style={styles.tlText}>
          Moved to <Text style={styles.tlStrong}>{item.to}</Text>
          {item.from ? ` (from ${item.from})` : ''}
        </Text>
        <Text style={styles.tlMeta}>{formatDate(item.at)}</Text>
      </>
    );
  } else {
    icon = item.direction === 'in' ? 'inbound' : 'outbound';
    text = (
      <>
        <Text style={styles.tlText} numberOfLines={1}>{item.subject}</Text>
        {item.snippet ? (
          <Text style={styles.tlMeta} numberOfLines={1}>{item.snippet}</Text>
        ) : null}
        <Text style={styles.tlMeta}>{item.direction === 'in' ? 'Received' : 'Sent'} · {formatDate(item.at)}</Text>
      </>
    );
  }
  if (item.kind === 'activity') {
    return (
      <View style={styles.tlRow}>
        <Pressable
          onPress={() => onToggleActivity(item.id, !item.done)}
          style={[styles.tlCheck, item.done && styles.tlCheckDone]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={item.done ? 'Mark not done' : 'Mark done'}
        >
          <Icon name="check" size={12} color={item.done ? colors.white : colors.borderStrong} />
        </Pressable>
        <Pressable style={styles.tlBody} onPress={() => onEditActivity(item.id)}>
          {text}
        </Pressable>
      </View>
    );
  }

  const inner = (
    <View style={styles.tlRow}>
      <View style={styles.tlIcon}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.tlBody}>{text}</View>
    </View>
  );
  if (item.kind === 'email') {
    return <Pressable onPress={() => onOpen(item)}>{inner}</Pressable>;
  }
  return inner;
}

function ActionBtn({
  label,
  tone,
  busy,
  onPress,
}: {
  label: string;
  tone: 'success' | 'danger' | 'neutral' | 'primary';
  busy: boolean;
  onPress: () => void;
}) {
  const t =
    tone === 'success'
      ? { bg: colors.success, fg: colors.white, bd: colors.success }
      : tone === 'danger'
        ? { bg: colors.dangerTint, fg: colors.danger, bd: colors.dangerTint }
        : tone === 'primary'
          ? { bg: colors.primary, fg: colors.white, bd: colors.primary }
          : { bg: colors.bg, fg: colors.textMuted, bd: colors.borderStrong };
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: t.bg, borderColor: t.bd },
        busy && { opacity: 0.5 },
        pressed && !busy && { opacity: 0.8 },
      ]}
      disabled={busy}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, { color: t.fg }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, label, value, last }: { icon: IconName; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowLabelWrap}>
        <Icon name={icon} size={15} color={colors.textSubtle} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function statusTint(status: string) {
  if (status === 'won') return { backgroundColor: colors.successTint };
  if (status === 'lost') return { backgroundColor: colors.dangerTint };
  return { backgroundColor: colors.infoTint };
}
function statusInk(status: string) {
  if (status === 'won') return { color: colors.success };
  if (status === 'lost') return { color: colors.danger };
  return { color: colors.info };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface },

  // Header card
  headerCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: 6,
    ...shadow.card,
  },
  refNum: { fontFamily: fonts.bold, fontSize: fontSize.xs, letterSpacing: 1, color: colors.primary },
  title: { fontFamily: fonts.display, fontSize: fontSize.h2, color: colors.ink },
  value: { fontFamily: fonts.bold, fontSize: fontSize.h1, color: colors.primary, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap', marginTop: space.xs },
  stagePill: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  stagePillText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  archivedPill: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusText: { fontFamily: fonts.bold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 88, borderRadius: radius.lg, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  actionText: { fontFamily: fonts.bold, fontSize: fontSize.md },

  // Generic section card
  sectionCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
    ...shadow.card,
  },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSubtle },

  // Stage chips
  stageRow: { gap: space.sm, paddingVertical: 2, paddingRight: space.sm },
  stageChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: space.sm,
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  stageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stageChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  stageChipTextActive: { fontFamily: fonts.bold, color: colors.white },

  // Detail rows
  rows: { marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  rowValue: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.ink, flexShrink: 1 },

  // Timeline
  timelineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineBtns: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipBtnText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  noteBox: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end', marginTop: space.xs },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  noteBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  noteBtnOff: { opacity: 0.5 },
  noteBtnText: { fontFamily: fonts.bold, color: colors.white, fontSize: fontSize.md },
  emptyTimeline: { fontFamily: fonts.regular, color: colors.textSubtle, fontSize: fontSize.sm, marginTop: space.sm },
  loadMore: { alignSelf: 'center', marginTop: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  loadMoreText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  tlRow: { flexDirection: 'row', gap: 10, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tlIcon: { width: 22, alignItems: 'center', paddingTop: 1 },
  tlCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  tlCheckDone: { backgroundColor: colors.success, borderColor: colors.success },
  tlBody: { flex: 1, gap: 2 },
  tlText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.ink },
  tlStrong: { fontFamily: fonts.semibold, color: colors.ink },
  tlDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  tlMeta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'capitalize' },

  // Error + header
  errorTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.danger },
  retry: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  retryText: { fontFamily: fonts.semibold, color: colors.primary },
  headerEdit: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.primary },

  // Lose sheet
  loseBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  loseSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.lg, gap: space.md },
  loseTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  loseInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  loseActions: { flexDirection: 'row', gap: 10 },
  loseCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center' },
  loseCancelText: { fontFamily: fonts.semibold, color: colors.textMuted },
  loseConfirm: { flex: 2, backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center' },
  loseConfirmText: { fontFamily: fonts.bold, color: colors.white },
});
