'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Anchor,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconMail } from '@tabler/icons-react';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { Money } from '@/components/primitives/Money';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { AddressFields, type Address } from '@/components/deals/AddressFields';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { QuickbooksPanel } from '@/components/deals/quickbooks/QuickbooksPanel';
import { ApiError } from '@/lib/api/client';
import {
  useAllStages,
  useCompanies,
  useCreateCompany,
  useCreatePerson,
  useDeal,
  useLoseDeal,
  usePersons,
  useUpdateDeal,
  useWinDeal,
} from '@/lib/api/hooks';

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

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: deal, isLoading } = useDeal(id);
  const { data: stages = [] } = useAllStages();
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const update = useUpdateDeal();
  const win = useWinDeal();
  const lose = useLoseDeal();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();
  const [emailOpen, emailCtl] = useDisclosure(false);

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

  if (isLoading || !deal || !form) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  const stageName = stages.find((s) => s.id === deal.stageId)?.name ?? '—';

  const save = () => {
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
        onSuccess: () => notifications.show({ message: 'Deal saved', color: 'green' }),
        onError: fail,
      },
    );
  };

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/deals" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Back to deals
        </Group>
      </Anchor>

      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{deal.title}</Title>
          <Group gap="sm" mt={4}>
            <Text fw={600}>
              <Money value={deal.value} currency={deal.currency} />
            </Text>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm">{stageName}</Text>
            <StatusBadge status={deal.status} />
          </Group>
        </div>
        <Button variant="light" leftSection={<IconMail size={16} />} onClick={emailCtl.open}>
          Send email
        </Button>
      </Group>

      <ComposeEmail opened={emailOpen} onClose={emailCtl.close} defaultDealId={deal.id} />

      <Grid gutter="lg">
        {/* Timeline (main) */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <DealTimeline dealId={deal.id} />
        </Grid.Col>

        {/* Details (sidebar) */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <Text fw={600}>Details</Text>
              <TextInput
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
              />
              <NumberInput
                label="Value (USD)"
                prefix="$"
                thousandSeparator=","
                min={0}
                value={form.value}
                onChange={(v) => setForm({ ...form, value: v })}
              />
              <CreatableSelect
                label="Company"
                placeholder="Search or create a company"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                value={form.companyId}
                onChange={(v) => setForm({ ...form, companyId: v })}
                onCreate={async (name) => {
                  const c = await createCompany.mutateAsync({ name });
                  return { value: c.id, label: c.name };
                }}
              />
              <CreatableSelect
                label="Primary contact"
                placeholder="Search or create a contact"
                options={persons.map((p) => ({ value: p.id, label: p.name }))}
                value={form.primaryPersonId}
                onChange={(v) => setForm({ ...form, primaryPersonId: v })}
                onCreate={async (name) => {
                  const p = await createPerson.mutateAsync({
                    name,
                    companyIds: form.companyId ? [form.companyId] : undefined,
                  });
                  return { value: p.id, label: p.name };
                }}
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
              <Divider label="Addresses" labelPosition="left" />
              <AddressFields label="Ship to (work site)" value={form.shipTo} onChange={(v) => setForm({ ...form, shipTo: v })} />
              <AddressFields label="Bill to (payer)" value={form.billTo} onChange={(v) => setForm({ ...form, billTo: v })} />

              <Button onClick={save} loading={update.isPending} mt="xs">
                Save changes
              </Button>

              {deal.status === 'open' ? (
                <>
                  <Divider />
                  <Group>
                    <Button color="teal" loading={win.isPending} onClick={() => win.mutate(deal.id)}>
                      Mark won
                    </Button>
                    <Button
                      color="red"
                      variant="light"
                      loading={lose.isPending}
                      onClick={() => lose.mutate({ id: deal.id })}
                    >
                      Mark lost
                    </Button>
                  </Group>
                </>
              ) : null}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Billing (QuickBooks estimates & invoices) */}
        <Grid.Col span={12}>
          <QuickbooksPanel deal={deal} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
