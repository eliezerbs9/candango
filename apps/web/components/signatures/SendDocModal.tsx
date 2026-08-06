'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useDealRecipients, useGenerateSignature } from '@/lib/api/hooks';

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

/**
 * Confirm + send a deal-scoped document for signature: pick the Customer signer (defaults to the deal's
 * primary contact) and choose whether to email them now. Used from the builder and from a draft card.
 */
export function SendDocModal({
  opened,
  onClose,
  dealId,
  docId,
  docName,
  secondSigner,
  onSent,
}: {
  opened: boolean;
  onClose: () => void;
  dealId: string;
  docId: string;
  docName?: string;
  secondSigner: boolean;
  /** Called after a successful send. When omitted, the modal navigates to the deal's Signatures tab. */
  onSent?: () => void;
}) {
  const router = useRouter();
  const generate = useGenerateSignature();
  const { data: recipients = [] } = useDealRecipients(dealId);
  const withEmail = useMemo(() => recipients.filter((r) => r.email), [recipients]);
  const [personId, setPersonId] = useState<string | null>(null);

  // Default the customer to the deal's primary contact (recipients endpoint returns it first).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || withEmail.length === 0) return;
    didInit.current = true;
    setPersonId((cur) => cur ?? withEmail[0].id);
  }, [withEmail]);

  const signer = useMemo(() => {
    const r = recipients.find((x) => x.id === personId);
    return r && r.email ? { name: `${r.firstName} ${r.lastName}`.trim() || r.name, email: r.email, personId: r.id } : null;
  }, [personId, recipients]);

  const submit = () => {
    if (!signer) {
      notifications.show({ message: 'Pick the customer who signs', color: 'red' });
      return;
    }
    generate.mutate(
      { dealId, signableDocumentTemplateId: docId, signerName: signer.name || undefined, signerEmail: signer.email, receiverPersonId: signer.personId, sendEmail: true },
      {
        onSuccess: () => {
          notifications.show({ message: 'Sent to the customer for signature', color: 'green' });
          onClose();
          if (onSent) onSent();
          else router.push(`/deals/${dealId}/signatures`);
        },
        onError: fail,
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={docName ? `Send “${docName}” for signature` : 'Send for signature'} centered>
      <Stack>
        <div>
          <Text size="sm" fw={500} mb={4}>
            Customer (signer) <Text span c="red">*</Text>
          </Text>
          <Select
            placeholder={withEmail.length ? 'Pick a person on this deal' : 'No deal people with an email'}
            data={withEmail.map((r) => ({ value: r.id, label: `${r.name} · ${r.email}` }))}
            value={personId}
            onChange={setPersonId}
            searchable
            comboboxProps={{ withinPortal: true }}
          />
        </div>
        {secondSigner && (
          <Text size="xs" c="dimmed">
            A second signer (your side) also signs — set on the document.
          </Text>
        )}
        <Text size="xs" c="dimmed">
          The signer is emailed a signing link now.
        </Text>
        <Button onClick={submit} loading={generate.isPending} disabled={!signer}>
          Send for signature
        </Button>
      </Stack>
    </Modal>
  );
}
