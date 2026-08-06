'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBan, IconCheck, IconClock, IconCopy, IconDots, IconDownload, IconFileText, IconInfoCircle, IconPencil, IconPlus, IconRefresh, IconSend, IconSignature, IconTrash, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import {
  useCreateDealDocFromTemplate,
  useCreateSignableDocument,
  useCustomFields,
  useDealDocuments,
  useDealSignatures,
  useDeleteSignableDocument,
  useDeleteSignature,
  useDuplicateDealDoc,
  useFileUrl,
  useResendSignature,
  useSignableDocuments,
  useUploadFile,
  useVoidSignature,
} from '@/lib/api/hooks';
import { getSignatureSignedUrl, type SignatureRequest, type SignatureStatus } from '@/lib/api/signatures';
import { hasSigningField, type SignableDocumentTemplate } from '@/lib/api/signable-documents';
import { useDealCtx } from '@/components/deals/DealContext';
import { SendDocModal } from '@/components/signatures/SendDocModal';

const STATUS_COLOR: Record<SignatureStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  signed: 'teal',
  declined: 'red',
  expired: 'gray',
  voided: 'orange',
};

const DOC_MAX = 25 * 1024 * 1024;
/** Only documents we can currently place fields on and send for signature. */
const SIGNABLE = /\.pdf$/i;

interface StoredDoc {
  name: string;
  type: string;
  key: string;
}

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
/** Short date + time, e.g. "8/5/26, 9:08 PM" — matches how the signing service lists documents. */
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

type FilterKey = 'all' | 'draft' | 'awaiting' | 'signed' | 'declined' | 'voided';
const FILTER_LABEL: Record<Exclude<FilterKey, 'all'>, string> = { draft: 'Drafts', awaiting: 'Awaiting', signed: 'Signed', declined: 'Declined', voided: 'Voided' };
/** Which filter bucket a sent request falls into. */
const bucketOf = (s: SignatureStatus): 'awaiting' | 'signed' | 'declined' | 'voided' =>
  s === 'signed' ? 'signed' : s === 'voided' ? 'voided' : s === 'declined' || s === 'expired' ? 'declined' : 'awaiting';

export function DealSignatures({ dealId }: { dealId: string }) {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user?.role === 'Admin');
  const { data: rows = [], isLoading } = useDealSignatures(dealId);
  const { data: drafts = [] } = useDealDocuments(dealId);
  const { data: docTemplates = [] } = useSignableDocuments();
  const createDoc = useCreateSignableDocument();
  const fromTemplate = useCreateDealDocFromTemplate();
  const [opened, ctl] = useDisclosure(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const busy = createDoc.isPending || fromTemplate.isPending;
  // The builder opens INSIDE the deal (keeps the deal header + tabs), not in Settings.
  const openBuilder = (d: { id: string }) => router.push(`/deals/${dealId}/signatures/${d.id}`);

  // Every source creates a one-off document scoped to THIS deal, opened in the builder — sent from there.
  const buildNew = () =>
    createDoc.mutate(
      { name: 'Untitled document', mode: 'builder', dealId, theme: { orientation: 'portrait', paperSize: 'letter' } },
      { onSuccess: openBuilder, onError: fail },
    );
  const useTemplate = (templateId: string) => fromTemplate.mutate({ id: templateId, dealId }, { onSuccess: openBuilder, onError: fail });

  // One unified list — drafts and sent requests together — ordered by creation date (newest first).
  const items = useMemo(
    () =>
      [
        ...drafts.map((d) => ({ kind: 'draft' as const, id: d.id, bucket: 'draft' as const, createdAt: d.createdAt, doc: d })),
        ...rows.map((r) => ({ kind: 'request' as const, id: r.id, bucket: bucketOf(r.status), createdAt: r.createdAt, r })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [drafts, rows],
  );
  const segData = useMemo(() => {
    const data = [{ value: 'all', label: `All (${items.length})` }];
    (['draft', 'awaiting', 'signed', 'declined', 'voided'] as const).forEach((b) => {
      const c = items.filter((i) => i.bucket === b).length;
      if (c) data.push({ value: b, label: `${FILTER_LABEL[b]} (${c})` });
    });
    return data;
  }, [items]);
  const activeFilter: FilterKey = segData.some((d) => d.value === filter) ? filter : 'all';
  const shown = activeFilter === 'all' ? items : items.filter((i) => i.bucket === activeFilter);

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Signatures</Text>
        <Menu withinPortal position="bottom-end" shadow="md">
          <Menu.Target>
            <Button size="xs" leftSection={<IconPlus size={14} />} loading={busy}>
              Create new
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Create a document — then edit &amp; send from the builder</Menu.Label>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={buildNew}>
              Build a new document (blank)
            </Menu.Item>
            <Menu.Item leftSection={<IconUpload size={14} />} onClick={ctl.open}>
              From a deal document (PDF)
            </Menu.Item>
            {docTemplates.length > 0 && (
              <>
                <Menu.Divider />
                <Menu.Label>From a saved template</Menu.Label>
                {docTemplates.map((t) => (
                  <Menu.Item key={t.id} leftSection={<IconFileText size={14} />} onClick={() => useTemplate(t.id)}>
                    {t.name}
                  </Menu.Item>
                ))}
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {items.length > 0 && segData.length > 2 && (
        <Group mb="md">
          <SegmentedControl size="xs" value={activeFilter} onChange={(v) => setFilter(v as FilterKey)} data={segData} />
        </Group>
      )}

      {isLoading && items.length === 0 ? (
        <Loader size="sm" />
      ) : items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No documents yet. Use <b>Create new</b> to build a document, then send it for signature.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {shown.map((it) =>
            it.kind === 'draft' ? (
              <DraftCard key={it.id} doc={it.doc} dealId={dealId} isAdmin={isAdmin} onEdit={() => openBuilder({ id: it.id })} />
            ) : (
              <SignatureCard key={it.id} r={it.r} dealId={dealId} />
            ),
          )}
        </SimpleGrid>
      )}

      <ImportPdfModal opened={opened} onClose={ctl.close} dealId={dealId} />
    </Card>
  );
}

// A US-Letter-ish page thumbnail — every card shows the document's first page inside this same frame.
const PAGE_BOX: CSSProperties = {
  width: 96,
  height: 124,
  background: '#fff',
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 3,
  boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
  overflow: 'hidden',
  flex: 'none',
};

/** Uniform preview frame: a centered "page" (first page of the document) on a gray backdrop, plus a status badge. */
function CardPreview({ children, onClick, badge }: { children: ReactNode; onClick?: () => void; badge: ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        height: 150,
        background: 'var(--mantine-color-gray-1)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
      {badge}
    </div>
  );
}

/** A signature request as a card: clicking opens the PDF; signed docs cannot be deleted (pending can be voided). */
function SignatureCard({ r, dealId }: { r: SignatureRequest; dealId: string }) {
  const token = useAuthStore((s) => s.token);
  // Once signed, always show the signed document (preview + open).
  const { data: preview } = useFileUrl(r.hasSigned ? r.signedFileKey : r.sourceFileKey);
  const del = useDeleteSignature(dealId);
  const voidReq = useVoidSignature(dealId);
  const resend = useResendSignature(dealId);
  const dup = useDuplicateDealDoc();
  // Terminal = no longer actionable; pending = still out for signature (can be resent or voided).
  const terminal = r.status === 'signed' || r.status === 'declined' || r.status === 'expired' || r.status === 'voided';
  const pending = !terminal;
  // Duplicating a sent doc copies its pre-PDF canvas (its source builder doc), never the flattened/signed PDF.
  const duplicate = () =>
    r.signableDocumentTemplateId &&
    dup.mutate(r.signableDocumentTemplateId, { onSuccess: (d) => notifications.show({ message: `Duplicated as “${d.name}” (draft)`, color: 'green' }), onError: fail });

  const openPdf = () => {
    if (preview?.url) window.open(preview.url, '_blank');
  };
  const downloadSigned = async () => {
    try {
      const { url } = await getSignatureSignedUrl(token!, r.id);
      window.open(url, '_blank');
    } catch (e) {
      fail(e);
    }
  };
  const doResend = () => resend.mutate(r.id, { onSuccess: () => notifications.show({ message: 'Re-sent to the signer', color: 'green' }), onError: fail });
  // Void a pending request: cancels it in the signing service and keeps it as a "voided" record (moves to the Voided filter).
  const doVoid = () => {
    if (!window.confirm(`Void “${r.title}”? It can no longer be signed. It stays as a voided record.`)) return;
    voidReq.mutate(r.id, {
      onSuccess: (data) =>
        notifications.show(
          data.engineVoided
            ? { message: 'Document voided and cancelled in the signing service', color: 'green' }
            : { message: `Voided here, but the signing service was not cancelled: ${data.engineError ?? 'unknown error'}`, color: 'yellow', autoClose: 9000 },
        ),
      onError: fail,
    });
  };
  // A terminal (declined/expired/voided) record can be permanently deleted; a signed one never can.
  const remove = () => {
    if (!window.confirm(`Delete “${r.title}” permanently?`)) return;
    del.mutate(r.id, { onSuccess: () => notifications.show({ message: 'Deleted', color: 'green' }), onError: fail });
  };

  return (
    <Card withBorder radius="md" p={0} h="100%" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CardPreview
        onClick={preview?.url ? openPdf : undefined}
        badge={
          <Badge variant="filled" color={STATUS_COLOR[r.status]} style={{ position: 'absolute', top: 8, right: 8, textTransform: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
            {r.status}
          </Badge>
        }
      >
        {/* The document's first page in the shared page frame — same look as a draft. */}
        <div style={PAGE_BOX}>
          {preview?.url ? (
            <iframe src={`${preview.url}#toolbar=0&navpanes=0&view=FitH&page=1`} title={r.title} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
          ) : (
            <Group justify="center" align="center" h="100%">
              <IconFileText size={26} color="var(--mantine-color-gray-5)" />
            </Group>
          )}
        </div>
      </CardPreview>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Text fw={600} lineClamp={1} style={{ cursor: preview?.url ? 'pointer' : 'default' }} onClick={openPdf}>
          {r.title}
        </Text>
        {/* Which fields the document carries — right below the name (not pills). */}
        <Text size="xs" c="dimmed">{r.hasInitials ? 'Signature · Initials' : 'Signature'}</Text>

        {/* Dates: created → sent → signed (the final signature when both parties sign). */}
        <Stack gap={1} mt={8}>
          <Text size="xs" c="dimmed">Created {fmtDateTime(r.createdAt)}</Text>
          {r.sentAt && <Text size="xs" c="dimmed">Sent {fmtDateTime(r.sentAt)}</Text>}
          {r.signedAt && <Text size="xs" c="dimmed">Signed {fmtDateTime(r.signedAt)}</Text>}
          {r.status === 'declined' && r.declinedAt && <Text size="xs" c="red">Declined {fmtDateTime(r.declinedAt)}</Text>}
          {r.status === 'voided' && <Text size="xs" c="orange.7">Voided</Text>}
        </Stack>

        {/* Signers last. */}
        <Stack gap={2} mt={8}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {r.signers.length > 1 ? 'Signers' : 'Signer'}
          </Text>
          {r.signers.map((s, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              {s.signed ? <IconCheck size={13} color="var(--mantine-color-teal-6)" /> : <IconClock size={13} color="var(--mantine-color-gray-5)" />}
              <Text size="xs" c={s.signed ? undefined : 'dimmed'} lineClamp={1}>
                {s.owner ? 'You' : s.name || 'Client'}
                {s.owner ? ' (sender)' : ' (customer)'}
                {s.signed ? '' : ' · pending'}
              </Text>
            </Group>
          ))}
        </Stack>

        <Group justify="space-between" mt="auto" pt="sm" gap="xs" wrap="nowrap">
          {r.hasSigned ? (
            <Button size="compact-xs" variant="light" leftSection={<IconDownload size={13} />} onClick={downloadSigned}>
              Signed PDF
            </Button>
          ) : r.ownerSignUrl ? (
            <Button size="compact-xs" component="a" href={r.ownerSignUrl} target="_blank" leftSection={<IconSignature size={13} />}>
              Sign your part
            </Button>
          ) : (
            <span />
          )}
          {(pending || r.auditUrl || (terminal && r.status !== 'signed') || r.signableDocumentTemplateId) && (
            <Menu position="bottom-end" withinPortal shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {/* Clicking the card already opens the PDF, so no "Open PDF" item here. */}
                {r.signableDocumentTemplateId && (
                  <Menu.Item leftSection={<IconCopy size={14} />} onClick={duplicate}>
                    Duplicate as draft
                  </Menu.Item>
                )}
                {pending && (
                  <Menu.Item leftSection={<IconRefresh size={14} />} onClick={doResend}>
                    Resend
                  </Menu.Item>
                )}
                {r.auditUrl && (
                  <Menu.Item component="a" href={r.auditUrl} target="_blank">
                    Audit trail
                  </Menu.Item>
                )}
                {/* A pending request is VOIDED (cancelled in Documenso, kept as a record); terminal ones can be deleted. Signed is immutable. */}
                {pending && (
                  <Menu.Item color="red" leftSection={<IconBan size={14} />} onClick={doVoid}>
                    Void
                  </Menu.Item>
                )}
                {terminal && r.status !== 'signed' && (
                  <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={remove}>
                    Delete
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </div>
    </Card>
  );
}

/** A deal document not yet sent: preview (page background or blank page), click to edit in the builder, quick-send, admin-only delete. */
function DraftCard({ doc, dealId, isAdmin, onEdit }: { doc: SignableDocumentTemplate; dealId: string; isAdmin: boolean; onEdit: () => void }) {
  const del = useDeleteSignableDocument();
  const dup = useDuplicateDealDoc();
  const [sendOpen, sendCtl] = useDisclosure(false);
  const firstBg = Array.isArray(doc.layout) ? (doc.layout[0] as { background?: string } | undefined)?.background ?? null : null;
  const { data: bg } = useFileUrl(firstBg);
  const pageCount = Array.isArray(doc.layout) ? doc.layout.length : 0;
  const canSend = hasSigningField(doc.layout); // no signature/initials field yet → can't be sent

  const remove = () => {
    if (!window.confirm(`Delete the draft “${doc.name}”?`)) return;
    del.mutate(doc.id, { onSuccess: () => notifications.show({ message: 'Draft deleted', color: 'green' }), onError: fail });
  };
  const duplicate = () => dup.mutate(doc.id, { onSuccess: (d) => notifications.show({ message: `Duplicated as “${d.name}”`, color: 'green' }), onError: fail });

  return (
    <Card withBorder radius="md" p={0} h="100%" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CardPreview
        onClick={onEdit}
        badge={
          <Badge variant="light" color="gray" style={{ position: 'absolute', top: 8, right: 8, textTransform: 'none' }}>
            Draft
          </Badge>
        }
      >
        {/* The first page in the shared page frame — the imported PDF's page image when there is one, else blank. */}
        <div style={{ ...PAGE_BOX, background: bg?.url ? `#fff url(${bg.url}) top center / cover no-repeat` : '#fff' }} />
      </CardPreview>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Text fw={600} lineClamp={1} style={{ cursor: 'pointer' }} onClick={onEdit}>
          {doc.name || 'Untitled document'}
        </Text>
        <Text size="xs" c="dimmed">{doc.parties === 'both' ? 'Signature · Customer + sender' : 'Signature · Customer only'}</Text>
        <Text size="xs" c="dimmed" mt={6}>
          Created {fmtDateTime(doc.createdAt)}
        </Text>
        <Text size="xs" c="dimmed">
          {pageCount || 1} page{pageCount === 1 ? '' : 's'} · not sent yet
        </Text>
        {!canSend && (
          <Text size="xs" c="orange.7" mt={4}>
            Add a signature or initials field to send.
          </Text>
        )}
        <Group justify="space-between" mt="auto" pt="sm" gap="xs" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Button size="compact-xs" variant="light" leftSection={<IconPencil size={13} />} onClick={onEdit}>
              Edit
            </Button>
            <Tooltip label="Add at least one signature or initials field first (Edit)." disabled={canSend} withArrow>
              <Button size="compact-xs" leftSection={<IconSend size={13} />} onClick={sendCtl.open} disabled={!canSend}>
                Send
              </Button>
            </Tooltip>
          </Group>
          <Group gap={2} wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" aria-label="Duplicate draft" onClick={duplicate} loading={dup.isPending}>
              <IconCopy size={16} />
            </ActionIcon>
            {isAdmin && (
              <ActionIcon variant="subtle" color="red" aria-label="Delete draft" onClick={remove} loading={del.isPending}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>
      </div>
      <SendDocModal opened={sendOpen} onClose={sendCtl.close} dealId={dealId} docId={doc.id} docName={doc.name} secondSigner={doc.parties === 'both'} onSent={sendCtl.close} />
    </Card>
  );
}

/**
 * Turn a PDF already on the deal into a signable document: pick the file, then open it in the
 * document builder (each PDF page becomes a builder page background). Nothing is sent from here —
 * the document is created, then reviewed / edited / sent from the builder.
 */
function ImportPdfModal({ opened, onClose, dealId }: { opened: boolean; onClose: () => void; dealId: string }) {
  const router = useRouter();
  const { form, setForm, save } = useDealCtx();
  const { data: allFields = [] } = useCustomFields('deal');
  const docFields = useMemo(() => allFields.filter((f) => f.type === 'document'), [allFields]);
  const createDoc = useCreateSignableDocument();
  const upload = useUploadFile();

  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const files: StoredDoc[] = useMemo(() => {
    if (!fieldKey) return [];
    const raw = (form.customFields[fieldKey] as StoredDoc[]) ?? [];
    return raw.filter((d) => SIGNABLE.test(d.name));
  }, [fieldKey, form.customFields]);

  const reset = () => {
    setFieldKey(null);
    setFileKey(null);
    setName('');
  };
  const close = () => {
    reset();
    onClose();
  };

  const pickField = (key: string | null) => {
    setFieldKey(key);
    setFileKey(null);
  };
  const pickFile = (key: string | null) => {
    setFileKey(key);
    const doc = files.find((d) => d.key === key);
    if (doc && !name.trim()) setName(doc.name.replace(/\.[^.]+$/, ''));
  };

  // Upload a new PDF straight into the selected document custom field, then select it.
  const uploadToField = async (file: File | null) => {
    if (!file || !fieldKey) return;
    if (!SIGNABLE.test(file.name)) {
      notifications.show({ message: 'Only PDF documents can be turned into a signable document.', color: 'red' });
      return;
    }
    if (file.size > DOC_MAX) {
      notifications.show({ message: `${file.name} is larger than 25 MB`, color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const key = await upload.mutateAsync({ entity: 'deal', file });
      const doc: StoredDoc = { name: file.name, type: file.type || 'application/pdf', key };
      const existing = (form.customFields[fieldKey] as StoredDoc[]) ?? [];
      const nextCF = { ...form.customFields, [fieldKey]: [...existing, doc] };
      setForm({ ...form, customFields: nextCF });
      save({ customFields: nextCF }); // persist the new document onto the deal
      setFileKey(key);
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // Create a deal-scoped builder document, then open it in the builder with the PDF queued for import.
  const openInBuilder = () => {
    if (!fileKey || !name.trim()) {
      notifications.show({ message: 'Choose a PDF and a name', color: 'red' });
      return;
    }
    createDoc.mutate(
      { name: name.trim(), mode: 'builder', dealId, theme: { orientation: 'portrait', paperSize: 'letter' } },
      {
        onSuccess: (d) => {
          close();
          router.push(`/deals/${dealId}/signatures/${d.id}?importPdf=${encodeURIComponent(fileKey)}`);
        },
        onError: fail,
      },
    );
  };

  return (
    <Modal opened={opened} onClose={close} title="Sign a document from this deal" centered size="lg">
      {docFields.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="gray">
          There are no <b>document</b> custom fields yet. Create one on the{' '}
          <Link href="/settings/fields">Fields page</Link> to store documents on deals, then sign one here.
        </Alert>
      ) : (
        <Stack>
          <Select
            label="Document field"
            placeholder="Pick a document field on this deal"
            required
            data={docFields.map((f) => ({ value: f.key, label: f.label }))}
            value={fieldKey}
            onChange={pickField}
          />

          {fieldKey && (
            <div>
              <Group justify="space-between" align="flex-end" mb={4}>
                <Text size="sm" fw={500}>
                  Document <Text span c="red">*</Text>
                </Text>
                <FileButton onChange={uploadToField} accept="application/pdf">
                  {(props) => (
                    <Button {...props} size="compact-xs" variant="subtle" leftSection={<IconUpload size={13} />} loading={busy}>
                      Upload PDF
                    </Button>
                  )}
                </FileButton>
              </Group>
              {files.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No PDF documents in this field yet — upload one to sign it.
                </Text>
              ) : (
                <Select
                  placeholder="Choose a document"
                  data={files.map((d) => ({ value: d.key, label: d.name }))}
                  value={fileKey}
                  onChange={pickFile}
                  comboboxProps={{ withinPortal: true }}
                />
              )}
            </div>
          )}

          {fileKey && <DocPreview objectKey={fileKey} />}

          <TextInput label="Document name" placeholder="e.g. Service Agreement" required value={name} onChange={(e) => setName(e.currentTarget.value)} />

          <Text size="xs" c="dimmed">
            Each PDF page opens as a page in the builder. Place the signature fields, then send it from there.
          </Text>

          <Button onClick={openInBuilder} loading={createDoc.isPending} disabled={!fileKey || !name.trim()}>
            Open in builder
          </Button>
        </Stack>
      )}
    </Modal>
  );
}

function DocPreview({ objectKey }: { objectKey: string }) {
  const { data, isLoading } = useFileUrl(objectKey);
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden', height: 320 }}>
      {isLoading || !data?.url ? (
        <Group justify="center" align="center" h="100%">
          <Loader size="sm" />
        </Group>
      ) : (
        <iframe src={`${data.url}#toolbar=0`} title="Document preview" style={{ width: '100%', height: '100%', border: 0 }} />
      )}
    </Paper>
  );
}
