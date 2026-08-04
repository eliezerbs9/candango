'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, FileButton, Group, Loader, Menu, Modal, Paper, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconDownload, IconLink, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import { useCreateSignature, useDealSignatures, useDeleteSignature, useUploadFile } from '@/lib/api/hooks';
import { getSignatureSignedUrl, type SignatureRequest, type SignatureStatus } from '@/lib/api/signatures';

const STATUS_COLOR: Record<SignatureStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  signed: 'teal',
  declined: 'red',
  expired: 'gray',
};

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
          No signature requests yet. Upload a document and send it for signature.
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
  const create = useCreateSignature();
  const upload = useUploadFile();
  const [title, setTitle] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle('');
    setSignerName('');
    setSignerEmail('');
    setSendEmail(true);
    setFile(null);
    setLink(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!title.trim() || !file || !signerEmail.trim()) {
      notifications.show({ message: 'Title, a PDF and the signer email are required', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const key = await upload.mutateAsync({ entity: 'signature', file });
      const res = await create.mutateAsync({
        dealId,
        title: title.trim(),
        fileKey: key,
        signerName: signerName.trim() || undefined,
        signerEmail: signerEmail.trim(),
        sendEmail,
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
    <Modal opened={opened} onClose={close} title="Request signature" centered>
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
          <TextInput label="Title" placeholder="e.g. Service Agreement" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Document (PDF)
            </Text>
            <FileButton onChange={setFile} accept="application/pdf">
              {(props) => (
                <Button {...props} variant="light" leftSection={<IconUpload size={14} />}>
                  {file ? file.name : 'Choose PDF'}
                </Button>
              )}
            </FileButton>
            <Text size="xs" c="dimmed" mt={4}>
              An “Acceptance &amp; Signature” page is appended to the end automatically.
            </Text>
          </div>
          <TextInput label="Signer name" value={signerName} onChange={(e) => setSignerName(e.currentTarget.value)} />
          <TextInput label="Signer email" type="email" required value={signerEmail} onChange={(e) => setSignerEmail(e.currentTarget.value)} />
          <Switch label="Email the signer now" checked={sendEmail} onChange={(e) => setSendEmail(e.currentTarget.checked)} />
          <Button onClick={submit} loading={busy}>
            Send for signature
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
