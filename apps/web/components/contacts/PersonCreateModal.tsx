'use client';

import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, TextInput } from '@mantine/core';
import type { Option } from '@/components/common/CreatableSelect';

/** Split a typed name: first whitespace token → first, the rest → last. */
function splitName(full: string): { first: string; last: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  const i = t.indexOf(' ');
  return i === -1 ? { first: t, last: '' } : { first: t.slice(0, i), last: t.slice(i + 1) };
}

type Pending = { resolve: (o: Option | null) => void };

/**
 * Turns a type-and-create person flow into a proper **First + Last** capture:
 * pass `prompt` as a CreatableSelect/CreatableMultiSelect `onCreate` — it opens
 * a small modal (prefilled by splitting what the user typed) and resolves with
 * the created option (or null if cancelled). `linkLabel`, when set, shows an
 * "Also add as a contact of <company>" checkbox.
 */
export function usePersonCreate(config: {
  create: (v: { firstName: string; lastName: string; link: boolean }) => Promise<Option>;
  linkLabel?: string;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [link, setLink] = useState(true);
  const [busy, setBusy] = useState(false);

  const prompt = (typed: string) =>
    new Promise<Option | null>((resolve) => {
      const s = splitName(typed);
      setFirst(s.first);
      setLast(s.last);
      setLink(true);
      setBusy(false);
      setPending({ resolve });
    });

  const close = (result: Option | null) => {
    pending?.resolve(result);
    setPending(null);
    setBusy(false);
  };

  const submit = async () => {
    if (!first.trim()) return;
    setBusy(true);
    try {
      const opt = await config.create({ firstName: first.trim(), lastName: last.trim(), link });
      close(opt);
    } catch {
      setBusy(false); // keep the modal open so the user can retry
    }
  };

  const modal = (
    <Modal opened={!!pending} onClose={() => close(null)} title="New contact" centered>
      <Stack gap="sm">
        <TextInput
          label="First name"
          required
          value={first}
          onChange={(e) => setFirst(e.currentTarget.value)}
          data-autofocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <TextInput
          label="Last name"
          value={last}
          onChange={(e) => setLast(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        {config.linkLabel ? (
          <Checkbox
            label={`Also add as a contact of ${config.linkLabel}`}
            checked={link}
            onChange={(e) => setLink(e.currentTarget.checked)}
          />
        ) : null}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!first.trim()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  return { prompt, modal };
}
