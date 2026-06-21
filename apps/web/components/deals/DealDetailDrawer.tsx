'use client';

import { useEffect, useState } from 'react';
import { Button, Divider, Drawer, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { AddressFields, type Address } from './AddressFields';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { ApiError } from '@/lib/api/client';
import { useCompanies, useLoseDeal, usePersons, useUpdateDeal, useWinDeal } from '@/lib/api/hooks';
import type { ApiDeal } from '@/lib/api/types';

interface DealForm {
  title: string;
  value: number | string;
  companyId: string | null;
  primaryPersonId: string | null;
  expectedCloseDate: string;
  shipTo: Address;
  billTo: Address;
  customFields: Record<string, unknown>;
}

export function DealDetailDrawer({
  deal,
  stageName,
  onClose,
}: {
  deal: ApiDeal | null;
  stageName: (id: string) => string;
  onClose: () => void;
}) {
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const update = useUpdateDeal();
  const win = useWinDeal();
  const lose = useLoseDeal();

  const [form, setForm] = useState<DealForm | null>(null);

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title,
        value: deal.value / 100,
        companyId: deal.companyId,
        primaryPersonId: deal.primaryPersonId,
        expectedCloseDate: deal.expectedCloseDate?.slice(0, 10) ?? '',
        shipTo: (deal.shipTo as Address) ?? {},
        billTo: (deal.billTo as Address) ?? {},
        customFields: deal.customFields ?? {},
      });
    }
  }, [deal]);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const save = () => {
    if (!deal || !form) return;
    update.mutate(
      {
        id: deal.id,
        title: form.title,
        value: Math.round(Number(form.value || 0) * 100),
        companyId: form.companyId || '',
        primaryPersonId: form.primaryPersonId || '',
        expectedCloseDate: form.expectedCloseDate || undefined,
        shipTo: form.shipTo,
        billTo: form.billTo,
        customFields: form.customFields,
      },
      {
        onSuccess: () => {
          notifications.show({ message: 'Deal saved', color: 'green' });
          onClose();
        },
        onError: fail,
      },
    );
  };

  return (
    <Drawer opened={!!deal} onClose={onClose} position="right" size="md" title={deal?.title}>
      {deal && form ? (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              Stage
            </Text>
            <Text size="sm">{stageName(deal.stageId)}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              Status
            </Text>
            <StatusBadge status={deal.status} />
          </Group>

          <TextInput label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <NumberInput
            label="Value (USD)"
            prefix="$"
            thousandSeparator=","
            min={0}
            value={form.value}
            onChange={(v) => setForm({ ...form, value: v })}
          />
          <Select
            label="Company"
            placeholder="No company"
            data={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={form.companyId}
            onChange={(v) => setForm({ ...form, companyId: v })}
            searchable
            clearable
          />
          <Select
            label="Primary contact"
            placeholder="No contact"
            data={persons.map((p) => ({ value: p.id, label: p.name }))}
            value={form.primaryPersonId}
            onChange={(v) => setForm({ ...form, primaryPersonId: v })}
            searchable
            clearable
          />
          <TextInput
            type="date"
            label="Expected close"
            value={form.expectedCloseDate}
            onChange={(e) => setForm({ ...form, expectedCloseDate: e.currentTarget.value })}
          />

          <CustomFieldsEditor
            entity="deal"
            values={form.customFields}
            onChange={(k, val) => setForm({ ...form, customFields: { ...form.customFields, [k]: val } })}
          />

          <Divider label="Addresses" labelPosition="left" mt="xs" />
          <AddressFields label="Ship to (work site)" value={form.shipTo} onChange={(v) => setForm({ ...form, shipTo: v })} />
          <AddressFields label="Bill to (payer)" value={form.billTo} onChange={(v) => setForm({ ...form, billTo: v })} />

          <Button onClick={save} loading={update.isPending} mt="xs">
            Save changes
          </Button>

          {deal.status === 'open' ? (
            <>
              <Divider mt="xs" />
              <Group>
                <Button color="teal" loading={win.isPending} onClick={() => win.mutate(deal.id, { onSuccess: onClose })}>
                  Mark won
                </Button>
                <Button
                  color="red"
                  variant="light"
                  loading={lose.isPending}
                  onClick={() => lose.mutate({ id: deal.id }, { onSuccess: onClose })}
                >
                  Mark lost
                </Button>
              </Group>
            </>
          ) : null}
        </Stack>
      ) : null}
    </Drawer>
  );
}
