/**
 * Deal detail — core fields, move-stage, lifecycle actions (win/lose/reopen/
 * archive), and a timeline (notes + activities + stage history) with add-note.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useActivities } from '@/lib/api/activities';
import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useDeal, useDealLifecycle, useMoveDeal, useStageHistory, useStages } from '@/lib/api/deals';
import { useCreateNote, useNotes } from '@/lib/api/notes';
import { formatDate, formatMoney } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

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
  | { kind: 'stage'; at: string; id: string; from: string | null; to: string };

const ACT_EMOJI: Record<string, string> = { call: '📞', meeting: '🗓️', task: '✅', email: '✉️' };

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deal = useDeal(id);
  const stages = useStages();
  const persons = usePersons();
  const companies = useCompanies();
  const move = useMoveDeal();
  const life = useDealLifecycle();
  const notes = useNotes(id);
  const acts = useActivities({ dealId: id });
  const hist = useStageHistory(id);
  const createNote = useCreateNote(id);
  const [noteText, setNoteText] = useState('');

  const pipelineStages = useMemo(
    () =>
      (stages.data ?? [])
        .filter((s) => s.pipelineId === deal.data?.pipelineId)
        .sort((a, b) => a.position - b.position),
    [stages.data, deal.data?.pipelineId],
  );

  const timeline = useMemo(() => {
    const items: TItem[] = [];
    notes.data?.forEach((n) => items.push({ kind: 'note', at: n.createdAt, id: n.id, body: n.body, author: n.authorName }));
    acts.data?.forEach((a) =>
      items.push({ kind: 'activity', at: a.createdAt, id: a.id, atype: a.type, subject: a.subject, done: a.done }),
    );
    hist.data?.forEach((e) =>
      items.push({ kind: 'stage', at: e.createdAt, id: e.id, from: e.fromStage?.name ?? null, to: e.toStage.name ?? 'Stage' }),
    );
    return items.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [notes.data, acts.data, hist.data]);

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

  async function addNote() {
    if (!noteText.trim()) return;
    await createNote.mutateAsync(noteText.trim());
    setNoteText('');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ ...headerOptions, title: d.title }} />

      <Text style={styles.title}>{d.title}</Text>
      <Text style={styles.value}>{formatMoney(d.value, d.currency)}</Text>
      <View style={styles.pillRow}>
        <View style={[styles.statusPill, statusTint(d.status)]}>
          <Text style={[styles.statusText, statusInk(d.status)]}>{d.status.toUpperCase()}</Text>
        </View>
        {d.archivedAt ? (
          <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statusText, { color: colors.textMuted }]}>ARCHIVED</Text>
          </View>
        ) : null}
      </View>

      {/* Lifecycle actions */}
      <View style={styles.actions}>
        {d.status === 'open' && !d.archivedAt ? (
          <>
            <ActionBtn label="Won" tone="success" busy={busy} onPress={() => life.win.mutate(d.id)} />
            <ActionBtn label="Lost" tone="danger" busy={busy} onPress={() => life.lose.mutate({ id: d.id })} />
            <ActionBtn label="Archive" tone="neutral" busy={busy} onPress={() => life.archive.mutate(d.id)} />
          </>
        ) : (
          <ActionBtn label="Reopen" tone="primary" busy={busy} onPress={() => life.reopen.mutate(d.id)} />
        )}
      </View>

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
              onPress={() => move.mutate({ id: d.id, stageId: s.id })}
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

      <View style={styles.card}>
        <Row label="Company" value={companyName ?? '—'} />
        <Row label="Primary contact" value={personName ?? '—'} />
        <Row label="Expected close" value={formatDate(d.expectedCloseDate)} />
        <Row label="Deal #" value={d.refNumber != null ? `#${d.refNumber}` : '—'} last />
      </View>

      {/* Timeline */}
      <Text style={styles.sectionLabel}>Timeline</Text>
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

      {timeline.length === 0 ? (
        <Text style={styles.emptyTimeline}>No activity yet.</Text>
      ) : (
        timeline.map((it) => <TimelineRow key={`${it.kind}-${it.id}`} item={it} />)
      )}

      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

function TimelineRow({ item }: { item: TItem }) {
  let icon = '•';
  let text: ReactNode = null;
  if (item.kind === 'note') {
    icon = '📝';
    text = (
      <>
        <Text style={styles.tlText}>{item.body}</Text>
        <Text style={styles.tlMeta}>{item.author} · {formatDate(item.at)}</Text>
      </>
    );
  } else if (item.kind === 'activity') {
    icon = ACT_EMOJI[item.atype] ?? '•';
    text = (
      <>
        <Text style={[styles.tlText, item.done && styles.tlDone]}>{item.subject}</Text>
        <Text style={styles.tlMeta}>{item.atype} · {formatDate(item.at)}</Text>
      </>
    );
  } else {
    icon = '↗️';
    text = (
      <>
        <Text style={styles.tlText}>
          Moved to <Text style={styles.tlStrong}>{item.to}</Text>
          {item.from ? ` (from ${item.from})` : ''}
        </Text>
        <Text style={styles.tlMeta}>{formatDate(item.at)}</Text>
      </>
    );
  }
  return (
    <View style={styles.tlRow}>
      <Text style={styles.tlIcon}>{icon}</Text>
      <View style={styles.tlBody}>{text}</View>
    </View>
  );
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
  const toneStyle =
    tone === 'success'
      ? { bg: colors.success, fg: colors.white }
      : tone === 'danger'
        ? { bg: colors.danger, fg: colors.white }
        : tone === 'primary'
          ? { bg: colors.primary, fg: colors.white }
          : { bg: colors.surface, fg: colors.textMuted };
  return (
    <Pressable
      style={[styles.actionBtn, { backgroundColor: toneStyle.bg }, busy && { opacity: 0.5 }]}
      disabled={busy}
      onPress={onPress}
    >
      <Text style={[styles.actionText, { color: toneStyle.fg }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.bg },
  title: { fontFamily: fonts.display, fontSize: fontSize.h2, color: colors.ink },
  value: { fontFamily: fonts.bold, fontSize: fontSize.h3, color: colors.success },
  pillRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  statusPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontFamily: fonts.bold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  actionBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: 11, alignItems: 'center' },
  actionText: { fontFamily: fonts.bold, fontSize: fontSize.md },
  sectionLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.md, marginBottom: space.xs },
  stageRow: { gap: space.sm, paddingVertical: 2 },
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
  card: {
    marginTop: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  rowValue: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.ink, flexShrink: 1 },
  noteBox: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
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
  noteBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
  noteBtnOff: { opacity: 0.5 },
  noteBtnText: { fontFamily: fonts.bold, color: colors.white, fontSize: fontSize.md },
  emptyTimeline: { fontFamily: fonts.regular, color: colors.textSubtle, fontSize: fontSize.sm, marginTop: space.sm },
  tlRow: { flexDirection: 'row', gap: 10, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tlIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  tlBody: { flex: 1, gap: 2 },
  tlText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.ink },
  tlStrong: { fontFamily: fonts.semibold, color: colors.ink },
  tlDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  tlMeta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'capitalize' },
  errorTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.danger },
  retry: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  retryText: { fontFamily: fonts.semibold, color: colors.primary },
});
