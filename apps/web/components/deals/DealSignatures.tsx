'use client';

import { useMemo, useState } from 'react';
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
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconDownload, IconInfoCircle, IconLink, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import {
  useCreateSignature,
  useCustomFields,
  useDealSignatures,
  useDeleteSignature,
  useFileUrl,
  useSignatureTemplates,
  useUploadFile,
} from '@/lib/api/hooks';
import { getSignatureSignedUrl, type SignatureRequest, type SignatureStatus } from '@/lib/api/signatures';
import type { DrawnField } from '@/lib/api/signature-templates';
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
  const token = useAuthStore((s) => s.token);
  const { data: rows = [], isLoading } = useDealSignatures(dealId);
  const del = useDeleteSignature(dealId);
  const [opened, ctl] = useDisclosure(false);

  const download = async (id: string) => {
    try {
      const { url } = await getSignatureSignedUrl(token!, id);
      window.open(url, '_blank');
    } catch (e) {
      fail(e);
    }
  };
  const remove = (r: SignatureRequest) => {
    if (!window.confirm(`Delete signature request “${r.title}”?`)) return;
    del.mutate(r.id, { onSuccess: () => notifications.show({ message: 'Deleted', color: 'green' }), onError: fail });
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Signatures</Text>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={ctl.open}>
          Request signature
        </Button>
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No signature requests yet. Pick a document from the deal and send it for signature.
        </Text>
      ) : (
        <Stack gap="xs">
          {rows.map((r) => (
            <Paper key={r.id} withBorder radius="sm" p="xs">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500} lineClamp={1}>
                    {r.title}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {r.signerName || r.signerEmail || '—'} ·{' '}
                    {r.signedAt ? `Signed ${new Date(r.signedAt).toLocaleDateString()}` : r.sentAt ? `Sent ${new Date(r.sentAt).toLocaleDateString()}` : 'Draft'}
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="light" color={STATUS_COLOR[r.status]} style={{ textTransform: 'none' }}>
                    {r.status}
                  </Badge>
                  {r.hasSigned && (
                    <ActionIcon variant="subtle" color="gray" onClick={() => download(r.id)} aria-label="Download signed" title="Download signed PDF">
                      <IconDownload size={16} />
                    </ActionIcon>
                  )}
                  <Menu position="bottom-end" withinPortal shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {r.auditUrl && (
                        <Menu.Item component="a" href={r.auditUrl} target="_blank">
                          Audit trail
                        </Menu.Item>
                      )}
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(r)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <RequestModal opened={opened} onClose={ctl.close} dealId={dealId} />
    </Card>
  );
}

function RequestModal({ opened, onClose, dealId }: { opened: boolean; onClose: () => void; dealId: string }) {
  const { form, setForm, save } = useDealCtx();
  const { data: allFields = [] } = useCustomFields('deal');
  const docFields = useMemo(() => allFields.filter((f) => f.type === 'document'), [allFields]);

  const create = useCreateSignature();
  const upload = useUploadFile();
  const { data: templates = [] } = useSignatureTemplates();

  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(''); // '' = custom (inline options)
  const [title, setTitle] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [acceptance, setAcceptance] = useState(true);
  const [initials, setInitials] = useState(false);
  const [drawnFields, setDrawnFields] = useState<DrawnField[]>([]);
  const [placing, setPlacing] = useState(false);
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
    setSignerName('');
    setSignerEmail('');
    setSendEmail(true);
    setAcceptance(true);
    setInitials(false);
    setDrawnFields([]);
    setPlacing(false);
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
    setPlacing(false);
  };
  const pickFile = (key: string | null) => {
    setFileKey(key);
    setDrawnFields([]);
    setPlacing(false);
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
    if (!fileKey || !title.trim() || !signerEmail.trim()) {
      notifications.show({ message: 'Choose a document, a title and the signer email', color: 'red' });
      return;
    }
    if (!useTemplate && !acceptance && !initials && drawnFields.length === 0) {
      notifications.show({ message: 'Select a signing option or place at least one field', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({
        dealId,
        title: title.trim(),
        fileKey,
        signerName: signerName.trim() || undefined,
        signerEmail: signerEmail.trim(),
        sendEmail,
        ...(useTemplate ? { signatureTemplateId: templateId } : { acceptance, initialsEveryPage: initials }),
        ...(drawnFields.length ? { drawnFields } : {}),
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

          <div>
            <Text size="sm" fw={500} mb={4}>
              Signing options
            </Text>
            <Select
              placeholder="Custom (choose below)"
              data={[
                { value: '', label: 'Custom (choose below)' },
                ...templates.map((t) => ({ value: t.id, label: t.name })),
              ]}
              value={templateId}
              onChange={(v) => setTemplateId(v ?? '')}
              comboboxProps={{ withinPortal: true }}
              allowDeselect={false}
              description={templates.length === 0 ? 'Tip: save reusable recipes in Settings → Signatures.' : 'Reuse a saved signature template, or configure options for this request.'}
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

          {fileKey && (
            <div>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Place fields on the document {drawnFields.length > 0 && <Text span c="candango" fw={600}>· {drawnFields.length}</Text>}
                </Text>
                <Button size="compact-xs" variant={placing ? 'light' : 'subtle'} onClick={() => setPlacing((p) => !p)}>
                  {placing ? 'Hide' : 'Place fields'}
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Optional — drop signature/initials/date/text fields onto exact spots. Combines with the options above.
              </Text>
              <Collapse in={placing}>
                <Paper withBorder radius="md" p="sm" mt="xs">
                  {filePreview?.url ? (
                    <SignatureFieldEditor fileUrl={filePreview.url} value={drawnFields} onChange={setDrawnFields} />
                  ) : (
                    <Group justify="center" py="md">
                      <Loader size="sm" />
                    </Group>
                  )}
                </Paper>
              </Collapse>
            </div>
          )}

          <Group grow>
            <TextInput label="Signer name" value={signerName} onChange={(e) => setSignerName(e.currentTarget.value)} />
            <TextInput label="Signer email" type="email" required value={signerEmail} onChange={(e) => setSignerEmail(e.currentTarget.value)} />
          </Group>
          <Switch label="Email the signer now" checked={sendEmail} onChange={(e) => setSendEmail(e.currentTarget.checked)} />
          <Button onClick={submit} loading={busy && create.isPending} disabled={!fileKey}>
            Send for signature
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
