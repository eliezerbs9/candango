/**
 * Estimates & invoices on the deal (mirrors the web QuickbooksPanel, mobile
 * scope: list + create/edit estimates + status + use-as-value + convert).
 * Estimates work natively; convert needs QuickBooks connected (API enforces it).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DocEditorModal } from '@/components/DocEditorModal';
import { Icon } from '@/components/Icon';
import { LinkAccountModal } from '@/components/LinkAccountModal';
import { PickerModal } from '@/components/PickerModal';
import {
  useConvertToInvoice,
  useCreateEstimate,
  useDealEstimates,
  useDealInvoices,
  useDeleteEstimate,
  useQuickbooksStatus,
  useSetEstimateStatus,
  useSetInvoiceStatus,
  useUpdateEstimate,
} from '@/lib/api/quickbooks';
import type { CreateDocInput, DealDoc } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
// 'paid' is not user-selectable — QuickBooks marks an invoice paid when its balance hits zero
// (the status label still shows 'paid' from the doc's own status when QBO reports it).
const INVOICE_STATUSES = ['draft', 'sent', 'void'];

export function QuickbooksPanel({
  dealId,
  dealTitle,
  currency,
  qbSubcustomerId,
}: {
  dealId: string;
  dealTitle: string;
  currency: string;
  qbSubcustomerId: string | null;
}) {
  const router = useRouter();
  const qb = useQuickbooksStatus();
  const connected = !!qb.data?.connected;
  const linked = !!qbSubcustomerId;
  const mode: 'native' | 'link' | 'qbo' = !connected ? 'native' : linked ? 'qbo' : 'link';
  const [linkOpen, setLinkOpen] = useState(false);

  const estimates = useDealEstimates(dealId);
  const invoices = useDealInvoices(dealId);
  const createEstimate = useCreateEstimate(dealId);
  const updateEstimate = useUpdateEstimate(dealId);
  const setEstStatus = useSetEstimateStatus(dealId);
  const setInvStatus = useSetInvoiceStatus(dealId);
  const deleteEstimate = useDeleteEstimate(dealId);
  const convert = useConvertToInvoice(dealId);

  // Estimates are deletable unless converted (closed), or QBO-sourced while disconnected.
  const isDeletable = (doc: DealDoc) => doc.status !== 'closed' && !(doc.source === 'quickbooks' && !connected);
  function removeEstimate(doc: DealDoc) {
    Alert.alert(`Delete estimate ${doc.docNumber ? `#${doc.docNumber}` : ''}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteEstimate.mutate(doc.id, { onError: (e) => setError(e instanceof Error ? e.message : 'Could not delete.') }),
      },
    ]);
  }

  const [editing, setEditing] = useState<DealDoc | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusFor, setStatusFor] = useState<{ doc: DealDoc; kind: 'estimate' | 'invoice' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimateDocs = estimates.data ?? [];
  const invoiceDocs = invoices.data ?? [];

  // Which docs count toward the deal value — mirrors the API's status-tier model (DealValueService)
  // and the web panel: every non-void invoice counts; among estimates only those in the single
  // highest tier present (accepted > sent > draft; closed/rejected excluded) count.
  const valueTier = (() => {
    const live = estimateDocs.filter((e) => e.status !== 'closed' && e.status !== 'rejected');
    if (live.some((e) => e.status === 'accepted')) return 'accepted';
    if (live.some((e) => e.status === 'sent')) return 'sent';
    if (live.some((e) => e.status === 'draft')) return 'draft';
    return null;
  })();
  const estimateInValue = (d: DealDoc) => d.status === valueTier;
  const invoiceInValue = (d: DealDoc) => d.status !== 'void';

  function newEstimate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function editEstimate(doc: DealDoc) {
    setEditing(doc);
    setEditorOpen(true);
  }
  function submitEstimate(input: CreateDocInput) {
    return editing ? updateEstimate.mutateAsync({ id: editing.id, body: input }) : createEstimate.mutateAsync(input);
  }
  function doConvert(id: string) {
    setError(null);
    convert.mutate({ estimateIds: [id] }, { onError: (e) => setError(e instanceof Error ? e.message : 'Convert failed. Connect QuickBooks first.') });
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="note" size={18} color={colors.ink} />
          <Text style={styles.header}>Estimates{mode === 'qbo' ? ' & invoices' : ''}</Text>
        </View>
        {mode === 'link' ? (
          <Pressable style={styles.linkBtn} onPress={() => setLinkOpen(true)}>
            <Text style={styles.linkBtnText}>Set up QuickBooks billing</Text>
          </Pressable>
        ) : null}
      </View>

      {mode === 'link' ? (
        <Text style={styles.linkHint}>QuickBooks is connected. Link this deal to create estimates and invoices there.</Text>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Estimates</Text>
        {mode !== 'link' ? (
          <Pressable style={styles.newBtn} onPress={newEstimate} hitSlop={8}>
            <Icon name="add" size={15} color={colors.primary} />
            <Text style={styles.newBtnText}>New estimate</Text>
          </Pressable>
        ) : null}
      </View>

      {estimates.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: space.md }} />
      ) : estimateDocs.length === 0 ? (
        <Text style={styles.empty}>No estimates yet.</Text>
      ) : (
        estimateDocs.map((doc) => (
          <DocRow
            key={doc.id}
            doc={doc}
            currency={currency}
            inValue={estimateInValue(doc)}
            onEdit={() => editEstimate(doc)}
            onStatus={() => setStatusFor({ doc, kind: 'estimate' })}
            onConvert={mode === 'qbo' && doc.status !== 'closed' ? () => doConvert(doc.id) : undefined}
            onDelete={isDeletable(doc) ? () => removeEstimate(doc) : undefined}
            converting={convert.isPending}
          />
        ))
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {invoiceDocs.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Invoices</Text>
          {invoiceDocs.map((doc) => (
            <DocRow key={doc.id} doc={doc} currency={currency} inValue={invoiceInValue(doc)} onStatus={() => setStatusFor({ doc, kind: 'invoice' })} />
          ))}
        </>
      ) : null}

      {mode === 'native' ? (
        <Text style={styles.hint}>
          Connect QuickBooks in{' '}
          <Text style={styles.hintLink} onPress={() => router.push('/settings/integrations')}>
            Settings → Integrations
          </Text>{' '}
          to create invoices.
        </Text>
      ) : null}

      <DocEditorModal
        visible={editorOpen}
        title={editing ? 'Edit estimate' : 'New estimate'}
        submitLabel={editing ? 'Save' : 'Create'}
        currency={currency}
        initial={editing}
        loading={createEstimate.isPending || updateEstimate.isPending}
        onClose={() => setEditorOpen(false)}
        onSubmit={submitEstimate}
      />

      <PickerModal
        visible={!!statusFor}
        title="Status"
        options={(statusFor?.kind === 'invoice' ? INVOICE_STATUSES : ESTIMATE_STATUSES).map((s) => ({ id: s, label: s }))}
        selectedId={statusFor?.doc.status}
        onSelect={(status) => {
          if (!status || !statusFor) return;
          if (statusFor.kind === 'invoice') setInvStatus.mutate({ id: statusFor.doc.id, status });
          else setEstStatus.mutate({ id: statusFor.doc.id, status });
        }}
        onClose={() => setStatusFor(null)}
      />

      <LinkAccountModal visible={linkOpen} dealId={dealId} dealTitle={dealTitle} onClose={() => setLinkOpen(false)} />
    </View>
  );
}

function DocRow({
  doc,
  currency,
  inValue,
  onEdit,
  onStatus,
  onConvert,
  onDelete,
  converting,
}: {
  doc: DealDoc;
  currency: string;
  inValue?: boolean;
  onEdit?: () => void;
  onStatus?: () => void;
  onConvert?: () => void;
  onDelete?: () => void;
  converting?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onEdit} disabled={!onEdit}>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{doc.docNumber ? `#${doc.docNumber}` : 'Estimate'}</Text>
          {inValue ? <Text style={styles.inValue}>In deal value</Text> : null}
        </View>
        <Text style={styles.docTotal}>{formatMoney(doc.totalAmount, currency)}</Text>
      </Pressable>
      <View style={styles.rowActions}>
        {/* Status is tappable to change it — the label + ▾ + "Status:" make that clear. */}
        <Pressable style={[styles.statusBtn, !onStatus && styles.statusBtnLocked]} onPress={onStatus} disabled={!onStatus}>
          <Text style={styles.statusCaption}>Status</Text>
          <Text style={styles.statusText}>{doc.status}</Text>
          {onStatus ? <Icon name="chevronDown" size={12} color={colors.primary} /> : null}
        </Pressable>
        {onConvert ? (
          <Pressable style={styles.miniBtn} onPress={onConvert} disabled={converting}>
            {converting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Icon name="invoice" size={13} color={colors.textMuted} />
                <Text style={styles.miniBtnText}>Invoice</Text>
              </>
            )}
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable style={[styles.miniBtn, styles.deleteBtn]} onPress={onDelete}>
            <Text style={[styles.miniBtnText, styles.deleteBtnText]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: space.md, gap: space.sm, ...shadow.card },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  linkBtn: { backgroundColor: colors.primaryTint, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5 },
  linkBtnText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: colors.primary },
  linkHint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  header: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.ink },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  newBtnText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  empty: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSubtle, paddingVertical: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.sm },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle, marginTop: space.sm },
  hintLink: { fontFamily: fonts.semibold, color: colors.primary, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.danger },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.sm + 2, gap: space.sm, backgroundColor: colors.surface },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  docTitle: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.ink },
  inValue: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.success },
  docTotal: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.ink },
  rowActions: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.primaryTint },
  statusBtnLocked: { borderColor: colors.border, backgroundColor: colors.surface },
  statusCaption: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSubtle, textTransform: 'uppercase' },
  statusText: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: colors.primary, textTransform: 'capitalize' },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bg },
  miniBtnText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textMuted },
  deleteBtn: { borderColor: colors.danger },
  deleteBtnText: { color: colors.danger },
});
