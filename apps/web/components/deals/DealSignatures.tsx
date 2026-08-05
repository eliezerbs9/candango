'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
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
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconClock, IconDots, IconDownload, IconExternalLink, IconFileText, IconInfoCircle, IconLink, IconPlus, IconRefresh, IconSignature, IconTrash, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import {
  useAddDealParticipant,
  useCreatePerson,
  useCreateSignature,
  useCustomFields,
  useDeal,
  useDealRecipients,
  useDealSignatures,
  useDeleteSignature,
  useFileUrl,
  useResendSignature,
  useGenerateSignature,
  useSignableDocuments,
  useSignatureTemplates,
  useUploadFile,
  useUsers,
} from '@/lib/api/hooks';
import { getSignatureSignedUrl, type SignatureRequest, type SignatureStatus } from '@/lib/api/signatures';
import type { DrawnField } from '@/lib/api/signature-templates';
import type { SignableDocumentTemplate } from '@/lib/api/signable-documents';
import { useDealCtx } from '@/components/deals/DealContext';
import { SignatureFieldEditor } from '@/components/deals/SignatureFieldEditor';

const STATUS_COLOR: Record<SignatureStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  signed: 'teal',
  declined: 'red',
  expired: 'gray',
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

export function DealSignatures({ dealId }: { dealId: string }) {
  const { data: rows = [], isLoading } = useDealSignatures(dealId);
  const { data: docTemplates = [] } = useSignableDocuments();
  const [opened, ctl] = useDisclosure(false);
  const [genOpened, genCtl] = useDisclosure(false);

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Signatures</Text>
        <Group gap="xs">
          {docTemplates.length > 0 && (
            <Button size="xs" variant="light" leftSection={<IconFileText size={14} />} onClick={genCtl.open}>
              Generate document
            </Button>
          )}
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={ctl.open}>
            Request signature
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No signature requests yet. Pick a document from the deal and send it for signature.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {rows.map((r) => (
            <SignatureCard key={r.id} r={r} dealId={dealId} />
          ))}
        </SimpleGrid>
      )}

      <RequestModal opened={opened} onClose={ctl.close} dealId={dealId} />
      <GenerateModal opened={genOpened} onClose={genCtl.close} dealId={dealId} templates={docTemplates} />
    </Card>
  );
}

/** A signature request as a card: document preview, status, signer, and manage actions. */
function SignatureCard({ r, dealId }: { r: SignatureRequest; dealId: string }) {
  const token = useAuthStore((s) => s.token);
  // Once signed, always show the signed document (preview + open).
  const { data: preview } = useFileUrl(r.hasSigned ? r.signedFileKey : r.sourceFileKey);
  const del = useDeleteSignature(dealId);
  const resend = useResendSignature(dealId);
  const finished = r.status === 'signed' || r.status === 'declined';
  const when = r.signedAt ? `Signed ${new Date(r.signedAt).toLocaleDateString()}` : r.sentAt ? `Sent ${new Date(r.sentAt).toLocaleDateString()}` : 'Draft';

  const downloadSigned = async () => {
    try {
      const { url } = await getSignatureSignedUrl(token!, r.id);
      window.open(url, '_blank');
    } catch (e) {
      fail(e);
    }
  };
  const doResend = () => resend.mutate(r.id, { onSuccess: () => notifications.show({ message: 'Re-sent to the signer', color: 'green' }), onError: fail });
  const remove = () => {
    if (!window.confirm(`Delete “${r.title}”? This also voids the document in the signing service.`)) return;
    del.mutate(r.id, { onSuccess: () => notifications.show({ message: 'Deleted', color: 'green' }), onError: fail });
  };

  return (
    <Card withBorder radius="md" p={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 150, background: 'var(--mantine-color-gray-1)' }}>
        {preview?.url ? (
          <iframe src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`} title={r.title} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
        ) : (
          <Group justify="center" align="center" h="100%">
            <IconFileText size={28} color="var(--mantine-color-gray-5)" />
          </Group>
        )}
        <Badge variant="filled" color={STATUS_COLOR[r.status]} style={{ position: 'absolute', top: 8, right: 8, textTransform: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {r.status}
        </Badge>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Text fw={600} lineClamp={1}>
          {r.title}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {when}
        </Text>

        {/* Signing parties + who's still missing */}
        <Stack gap={2} mt={6}>
          {r.signers.map((s, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              {s.signed ? <IconCheck size={13} color="var(--mantine-color-teal-6)" /> : <IconClock size={13} color="var(--mantine-color-gray-5)" />}
              <Text size="xs" c={s.signed ? undefined : 'dimmed'} lineClamp={1}>
                {s.owner ? 'You' : s.name || 'Client'}
                {s.owner ? '' : ' (customer)'}
                {s.signed ? '' : ' · pending'}
              </Text>
            </Group>
          ))}
        </Stack>

        <Group gap={4} mt={6}>
          <Badge size="xs" variant="light" color="candango" style={{ textTransform: 'none' }}>
            Signature
          </Badge>
          {r.hasInitials && (
            <Badge size="xs" variant="light" color="violet" style={{ textTransform: 'none' }}>
              Initials
            </Badge>
          )}
        </Group>

        <Group justify="space-between" mt="sm" gap="xs" wrap="nowrap">
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
          <Menu position="bottom-end" withinPortal shadow="sm">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {preview?.url && (
                <Menu.Item leftSection={<IconExternalLink size={14} />} component="a" href={preview.url} target="_blank">
                  View document
                </Menu.Item>
              )}
              {!finished && (
                <Menu.Item leftSection={<IconRefresh size={14} />} onClick={doResend}>
                  Resend
                </Menu.Item>
              )}
              {r.auditUrl && (
                <Menu.Item component="a" href={r.auditUrl} target="_blank">
                  Audit trail
                </Menu.Item>
              )}
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={remove}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </div>
    </Card>
  );
}

function GenerateModal({
  opened,
  onClose,
  dealId,
  templates,
}: {
  opened: boolean;
  onClose: () => void;
  dealId: string;
  templates: SignableDocumentTemplate[];
}) {
  const generate = useGenerateSignature();
  const { data: deal } = useDeal(dealId);
  const { data: users = [] } = useUsers();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [signer, setSigner] = useState<SignerValue | null>(null);
  const [bothParties, setBothParties] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [link, setLink] = useState<string | null>(null);

  // When the chosen template is signed by both parties, show who signs as the sender (from the template).
  const tpl = templates.find((t) => t.id === templateId);
  const senderLabel =
    tpl?.parties === 'both'
      ? tpl.party2Source === 'user'
        ? users.find((u) => u.id === tpl.party2UserId)?.name || 'a specific workspace user'
        : users.find((u) => u.id === deal?.ownerUserId)?.name || 'the deal owner (sales rep)'
      : null;

  const close = () => {
    setTemplateId(null);
    setSigner(null);
    setBothParties(false);
    setSendEmail(true);
    setLink(null);
    onClose();
  };

  const submit = async () => {
    if (!templateId) {
      notifications.show({ message: 'Pick a document template', color: 'red' });
      return;
    }
    if (!signer?.email) {
      notifications.show({ message: 'Pick a signer', color: 'red' });
      return;
    }
    try {
      const res = await generate.mutateAsync({
        dealId,
        signableDocumentTemplateId: templateId,
        signerName: signer.name || undefined,
        signerEmail: signer.email,
        receiverPersonId: signer.personId,
        sendEmail,
        // parties are defined by the document template
      });
      setLink(res.signingUrl ?? null);
      notifications.show({ message: sendEmail ? 'Generated and sent to the signer' : 'Document generated', color: 'green' });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Generate a document for signature" centered>
      {link ? (
        <Stack>
          <Text size="sm">Signing link (share it with the signer):</Text>
          <TextInput readOnly value={link} />
          <Group justify="flex-end">
            <Button variant="default" leftSection={<IconLink size={14} />} onClick={() => { navigator.clipboard.writeText(link); notifications.show({ message: 'Copied', color: 'green' }); }}>
              Copy link
            </Button>
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Select
            label="Document template"
            placeholder="Pick a document to generate"
            required
            data={templates.map((t) => ({ value: t.id, label: t.name }))}
            value={templateId}
            onChange={setTemplateId}
            data-autofocus
          />
          <Text size="xs" c="dimmed">
            Content is filled from this deal.
          </Text>
          {senderLabel && (
            <Alert color="candango" variant="light" py="xs">
              <Text size="xs">
                Both parties sign — <strong>{senderLabel}</strong> signs as the sender (set by the template).
              </Text>
            </Alert>
          )}
          <SignerFields
            dealId={dealId}
            companyId={deal?.companyId ?? null}
            signer={signer}
            onSigner={setSigner}
            bothParties={bothParties}
            onBothParties={setBothParties}
            sendEmail={sendEmail}
            onSendEmail={setSendEmail}
            hideParties
          />
          <Button onClick={submit} loading={generate.isPending} disabled={!templateId || !signer}>
            Generate &amp; send
          </Button>
        </Stack>
      )}
    </Modal>
  );
}

function RequestModal({ opened, onClose, dealId }: { opened: boolean; onClose: () => void; dealId: string }) {
  const { deal, form, setForm, save } = useDealCtx();
  const { data: allFields = [] } = useCustomFields('deal');
  const docFields = useMemo(() => allFields.filter((f) => f.type === 'document'), [allFields]);

  const create = useCreateSignature();
  const upload = useUploadFile();
  const { data: templates = [] } = useSignatureTemplates();

  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(''); // '' = custom (inline options)
  const [title, setTitle] = useState('');
  const [signer, setSigner] = useState<SignerValue | null>(null);
  const [bothParties, setBothParties] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [acceptance, setAcceptance] = useState(true);
  const [initials, setInitials] = useState(false);
  const [drawnFields, setDrawnFields] = useState<DrawnField[]>([]);
  const [method, setMethod] = useState<'options' | 'fields'>('options');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const useTemplate = templateId !== '';
  const { data: filePreview } = useFileUrl(fileKey);

  // Signable documents currently held by the selected custom field.
  const files: StoredDoc[] = useMemo(() => {
    if (!fieldKey) return [];
    const raw = (form.customFields[fieldKey] as StoredDoc[]) ?? [];
    return raw.filter((d) => SIGNABLE.test(d.name));
  }, [fieldKey, form.customFields]);

  const reset = () => {
    setFieldKey(null);
    setFileKey(null);
    setTemplateId('');
    setTitle('');
    setSigner(null);
    setBothParties(false);
    setSendEmail(true);
    setAcceptance(true);
    setInitials(false);
    setDrawnFields([]);
    setMethod('options');
    setLink(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  // Drawn fields are page-specific to a document, so reset them whenever the document changes.
  const pickField = (key: string | null) => {
    setFieldKey(key);
    setFileKey(null);
    setDrawnFields([]);
  };
  const pickFile = (key: string | null) => {
    setFileKey(key);
    setDrawnFields([]);
    const doc = files.find((d) => d.key === key);
    if (doc && !title.trim()) setTitle(doc.name.replace(/\.[^.]+$/, ''));
  };

  // Upload a new PDF straight into the selected document custom field, then select it.
  const uploadToField = async (file: File | null) => {
    if (!file || !fieldKey) return;
    if (!SIGNABLE.test(file.name)) {
      notifications.show({ message: 'Only PDF documents can be sent for signature.', color: 'red' });
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
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!fileKey || !title.trim() || !signer?.email) {
      notifications.show({ message: 'Choose a document, a title and a signer', color: 'red' });
      return;
    }
    if (method === 'fields') {
      if (drawnFields.length === 0) {
        notifications.show({ message: 'Place at least one field on the document', color: 'red' });
        return;
      }
    } else if (!useTemplate && !acceptance && !initials) {
      notifications.show({ message: 'Pick a template or a signing option', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({
        dealId,
        title: title.trim(),
        fileKey,
        signerName: signer.name || undefined,
        signerEmail: signer.email,
        receiverPersonId: signer.personId,
        sendEmail,
        bothParties,
        // Manual field placement is exclusive with the template / acceptance-page options.
        ...(method === 'fields'
          ? { drawnFields, acceptance: false }
          : useTemplate
            ? { signatureTemplateId: templateId }
            : { acceptance, initialsEveryPage: initials }),
      });
      setLink(res.signingUrl ?? null);
      notifications.show({ message: sendEmail ? 'Sent to the signer' : 'Signature request created', color: 'green' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Request signature" centered size="lg">
      {link ? (
        <Stack>
          <Text size="sm">Signing link (share it with the signer):</Text>
          <TextInput readOnly value={link} />
          <Group justify="flex-end">
            <Button
              variant="default"
              leftSection={<IconLink size={14} />}
              onClick={() => {
                navigator.clipboard.writeText(link);
                notifications.show({ message: 'Copied', color: 'green' });
              }}
            >
              Copy link
            </Button>
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      ) : docFields.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="gray">
          There are no <b>document</b> custom fields yet. Create one on the{' '}
          <Link href="/settings/fields">Fields page</Link> to store documents on deals, then request a signature here.
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
                    <Button {...props} size="compact-xs" variant="subtle" leftSection={<IconUpload size={13} />} loading={busy && !create.isPending}>
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

          <TextInput label="Title" placeholder="e.g. Service Agreement" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />

          <SignerFields
            dealId={dealId}
            companyId={deal.companyId ?? null}
            signer={signer}
            onSigner={setSigner}
            bothParties={bothParties}
            onBothParties={(b) => {
              setBothParties(b);
              if (!b) setDrawnFields((fs) => fs.filter((f) => f.party !== 'sender'));
            }}
            sendEmail={sendEmail}
            onSendEmail={setSendEmail}
            hideParties={method === 'options' && useTemplate}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              How to set up signing
            </Text>
            <SegmentedControl
              fullWidth
              value={method}
              onChange={(v) => setMethod(v as 'options' | 'fields')}
              data={[
                { value: 'options', label: 'Signing options' },
                { value: 'fields', label: 'Place fields manually' },
              ]}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {method === 'fields'
                ? 'Drop the exact signature/date fields onto the page — replaces the options below.'
                : 'Reuse a saved template, or add an acceptance page / initials.'}
            </Text>
          </div>

          {method === 'options' ? (
            <div>
              <Select
                label="Signature template"
                placeholder="Custom (choose below)"
                data={[{ value: '', label: 'Custom (choose below)' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
                value={templateId}
                onChange={(v) => setTemplateId(v ?? '')}
                comboboxProps={{ withinPortal: true }}
                allowDeselect={false}
                description={templates.length === 0 ? 'Tip: save reusable recipes in Settings → Signatures.' : 'Reuse a saved signature template, or configure options below.'}
              />
              {!useTemplate && (
                <Stack gap={6} mt={8}>
                  <Checkbox
                    label="Acceptance & Signature page"
                    description="Appends a page with signature, date and printed name at the end."
                    checked={acceptance}
                    onChange={(e) => setAcceptance(e.currentTarget.checked)}
                  />
                  <Checkbox
                    label="Initials on every page"
                    description="Adds an initials field to the footer of every page."
                    checked={initials}
                    onChange={(e) => setInitials(e.currentTarget.checked)}
                  />
                </Stack>
              )}
            </div>
          ) : !fileKey ? (
            <Text size="xs" c="dimmed">
              Pick a document above to place fields on it.
            </Text>
          ) : (
            <div>
              <Text size="sm" fw={500} mb={2}>
                Place fields on the document {drawnFields.length > 0 && <Text span c="candango" fw={600}>· {drawnFields.length}</Text>}
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                Drop <b>Customer</b> fields{bothParties ? <> and <b>Sender</b> fields</> : ''} onto exact spots — one signature per party.
              </Text>
              <Paper withBorder radius="md" p="sm">
                {filePreview?.url ? (
                  <SignatureFieldEditor fileUrl={filePreview.url} value={drawnFields} onChange={setDrawnFields} senderFields={bothParties} />
                ) : (
                  <Group justify="center" py="md">
                    <Loader size="sm" />
                  </Group>
                )}
              </Paper>
            </div>
          )}
          <Button onClick={submit} loading={busy && create.isPending} disabled={!fileKey || !signer}>
            Send for signature
          </Button>
        </Stack>
      )}
    </Modal>
  );
}

export interface SignerValue {
  name: string;
  email: string;
  personId?: string;
}

/**
 * Signer selection for a signature request: the client is a person ON the deal (pick, or create +
 * link), and you choose whether just the client signs or both parties (the deal owner counter-signs).
 */
function SignerFields({
  dealId,
  companyId,
  signer,
  onSigner,
  bothParties,
  onBothParties,
  senderName,
  sendEmail,
  onSendEmail,
  hideParties,
}: {
  dealId: string;
  companyId: string | null;
  signer: SignerValue | null;
  onSigner: (s: SignerValue | null) => void;
  bothParties: boolean;
  onBothParties: (b: boolean) => void;
  /** When both parties sign: who signs as the sender (shown read-only). */
  senderName?: string | null;
  sendEmail: boolean;
  onSendEmail: (b: boolean) => void;
  hideParties?: boolean;
}) {
  const { data: recipients = [] } = useDealRecipients(dealId);
  const createPerson = useCreatePerson();
  const addParticipant = useAddDealParticipant();
  const [personId, setPersonId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const withEmail = recipients.filter((r) => r.email);

  // Default the signer to the deal's primary contact (the recipients endpoint returns it first).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || withEmail.length === 0) return;
    didInit.current = true;
    setPersonId((cur) => cur ?? withEmail[0].id);
  }, [withEmail]);

  // Resolve the picked person to a signer — always "First Last" for the document (not the display format).
  useEffect(() => {
    const r = recipients.find((x) => x.id === personId);
    const name = r ? `${r.firstName} ${r.lastName}`.trim() || r.name : '';
    onSigner(r && r.email ? { name, email: r.email, personId: r.id } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, recipients]);

  const addPerson = async () => {
    if (!first.trim() || !email.trim()) {
      notifications.show({ message: 'First name and email are required', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const p = await createPerson.mutateAsync({ firstName: first.trim(), lastName: last.trim(), email: email.trim(), companyIds: companyId ? [companyId] : undefined });
      await addParticipant.mutateAsync({ dealId, personId: p.id });
      setPersonId(p.id); // recipients refetch via invalidation; the effect resolves the signer
      setAdding(false);
      setFirst('');
      setLast('');
      setEmail('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="sm">
      <div>
        <Group justify="space-between" align="flex-end" mb={4}>
          <Text size="sm" fw={500}>
            Customer (signer) <Text span c="red">*</Text>
          </Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconPlus size={13} />} onClick={() => setAdding((a) => !a)}>
            New person
          </Button>
        </Group>
        <Select
          placeholder={withEmail.length ? 'Pick a person on this deal' : 'No deal people with an email — add one'}
          data={withEmail.map((r) => ({ value: r.id, label: `${r.name} · ${r.email}` }))}
          value={personId}
          onChange={setPersonId}
          searchable
          comboboxProps={{ withinPortal: true }}
        />
        <Collapse in={adding}>
          <Paper withBorder radius="sm" p="xs" mt="xs">
            <Group grow>
              <TextInput size="xs" label="First name" value={first} onChange={(e) => setFirst(e.currentTarget.value)} />
              <TextInput size="xs" label="Last name" value={last} onChange={(e) => setLast(e.currentTarget.value)} />
            </Group>
            <TextInput size="xs" mt="xs" label="Email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            <Text size="xs" c="dimmed" mt={4}>
              Added to this deal{companyId ? ' and its company' : ''}.
            </Text>
            <Group justify="flex-end" mt="xs">
              <Button size="xs" onClick={addPerson} loading={busy}>
                Add &amp; select
              </Button>
            </Group>
          </Paper>
        </Collapse>
      </div>

      {!hideParties && (
        <div>
          <Text size="sm" fw={500} mb={4}>
            Signed by
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { value: 'one', label: 'Customer only' },
              { value: 'both', label: 'Both parties' },
            ]}
            value={bothParties ? 'both' : 'one'}
            onChange={(v) => onBothParties(v === 'both')}
          />
        </div>
      )}

      {bothParties && (
        <Text size="sm">
          <Text span fw={500}>
            Sender:
          </Text>{' '}
          {senderName?.trim() || 'You (the deal owner)'}{' '}
          <Text span c="dimmed" size="xs">
            — signs your side; either party can sign anytime.
          </Text>
        </Text>
      )}

      <Switch label="Email the signer(s) now" checked={sendEmail} onChange={(e) => onSendEmail(e.currentTarget.checked)} />
    </Stack>
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
