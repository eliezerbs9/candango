'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconMail, IconReceipt2, IconTruckDelivery } from '@tabler/icons-react';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { Money } from '@/components/primitives/Money';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import { AddressFields, type Address } from '@/components/deals/AddressFields';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { DealProposals } from '@/components/proposals/DealProposals';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { QuickbooksPanel } from '@/components/deals/quickbooks/QuickbooksPanel';
import { ApiError } from '@/lib/api/client';
import {
  useAllStages,
  useCompanies,
  useCreateCompany,
  useCustomFields,
  useCreatePerson,
  useArchiveDeal,
  useDeal,
  useDealEstimates,
  useLoseDeal,
  usePersons,
  useQuickbooksStatus,
  useReopenDeal,
  useUpdateDeal,
  useWinDeal,
} from '@/lib/api/hooks';
import { WinConvertModal } from '@/components/deals/quickbooks/WinConvertModal';

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
  const reopen = useReopenDeal();
  const archive = useArchiveDeal();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();
  const { data: qb } = useQuickbooksStatus();
  const { data: dealEstimates = [] } = useDealEstimates(id);
  const { data: dealFields = [] } = useCustomFields('deal');
  const [emailOpen, emailCtl] = useDisclosure(false);
  const [winConvertOpen, winConvertCtl] = useDisclosure(false);

  const [form, setForm] = useState<DealForm | null>(null);

  // Type-and-create a contact → captures First + Last (prefilled from the typed text).
  const personCreate = usePersonCreate({
    linkLabel: form?.companyId ? companies.find((c) => c.id === form.companyId)?.name : undefined,
    create: async ({ firstName, lastName, link }) => {
      const p = await createPerson.mutateAsync({
        firstName,
        lastName,
        companyIds: link && form?.companyId ? [form.companyId] : undefined,
      });
      return { value: p.id, label: p.name };
    },
  });

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

  // A compact, right-aligned save — the whole deal saves from any tab.
  const saveBar = (
    <Group justify="flex-end" mt="md">
      <Button size="xs" onClick={save} loading={update.isPending}>
        Save changes
      </Button>
    </Group>
  );

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
          {deal.refNumber != null && (
            <Text size="xs" c="dimmed" fw={600}>
              DEAL #{deal.refNumber}
            </Text>
          )}
          <Title order={3}>{deal.title}</Title>
          <Group gap="sm" mt={4}>
            <Text fw={600}>
              <Money value={deal.value} currency={deal.currency} />
            </Text>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm">{stageName}</Text>
            <StatusBadge status={deal.status} />
            {deal.archivedAt && (
              <Badge color="gray" variant="light">
                Archived
              </Badge>
            )}
          </Group>
        </div>
        <Group gap="sm">
          {deal.status === 'open' && !deal.archivedAt && (
            <>
              <Button
                color="teal"
                loading={win.isPending}
                onClick={() =>
                  win.mutate(deal.id, {
                    onSuccess: () => {
                      const openEst = dealEstimates.filter((e) => e.status !== 'closed');
                      if (qb?.connected && deal.qbSubcustomerId && openEst.length > 0) winConvertCtl.open();
                    },
                    onError: fail,
                  })
                }
              >
                Mark won
              </Button>
              <Button color="red" variant="light" loading={lose.isPending} onClick={() => lose.mutate({ id: deal.id })}>
                Mark lost
              </Button>
            </>
          )}
          {(deal.status !== 'open' || deal.archivedAt) && (
            <Button variant="light" loading={reopen.isPending} onClick={() => reopen.mutate(deal.id, { onError: fail })}>
              Reopen
            </Button>
          )}
          {!deal.archivedAt && (
            <Button variant="default" loading={archive.isPending} onClick={() => archive.mutate(deal.id, { onError: fail })}>
              Archive
            </Button>
          )}
          <Button variant="light" leftSection={<IconMail size={16} />} onClick={emailCtl.open}>
            Send email
          </Button>
        </Group>
      </Group>

      {personCreate.modal}
      <ComposeEmail opened={emailOpen} onClose={emailCtl.close} defaultDealId={deal.id} />
      <WinConvertModal dealId={deal.id} currency={deal.currency} opened={winConvertOpen} onClose={winConvertCtl.close} />

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          {dealFields.length > 0 && <Tabs.Tab value="fields">Custom fields</Tabs.Tab>}
          <Tabs.Tab value="proposals">Proposals</Tabs.Tab>
          <Tabs.Tab value="billing">{qb?.connected ? 'Estimates & invoices' : 'Estimates'}</Tabs.Tab>
        </Tabs.List>

        {/* Overview — system fields (Details) + Activity */}
        <Tabs.Panel value="overview" pt="lg">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <DealTimeline dealId={deal.id} />
            </Grid.Col>
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
                    disabled={dealEstimates.length > 0}
                    description={
                      dealEstimates.length > 0
                        ? 'From the estimates counted below — edit those to change the value.'
                        : undefined
                    }
                  />
                  <TextInput
                    type="date"
                    label="Expected close"
                    value={form.expectedCloseDate}
                    onChange={(e) => setForm({ ...form, expectedCloseDate: e.currentTarget.value })}
                  />
                  <Divider label="People" labelPosition="left" />
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
                    onCreate={personCreate.prompt}
                  />
                  {saveBar}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Custom fields */}
        {dealFields.length > 0 && (
          <Tabs.Panel value="fields" pt="lg">
            <Card withBorder radius="md" padding="lg">
              <CustomFieldsEditor
                entity="deal"
                values={form.customFields}
                onChange={(k, val) => setForm({ ...form, customFields: { ...form.customFields, [k]: val } })}
              />
              {saveBar}
            </Card>
          </Tabs.Panel>
        )}

        {/* Proposals */}
        <Tabs.Panel value="proposals" pt="lg">
          <DealProposals dealId={deal.id} />
        </Tabs.Panel>

        {/* Estimates & invoices (+ QuickBooks addresses) */}
        <Tabs.Panel value="billing" pt="lg">
          <Stack gap="lg">
            {qb?.connected && (
              <Card withBorder radius="md" padding="lg">
                <Group justify="space-between" mb="md">
                  <Text fw={600}>Addresses</Text>
                  <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
                    QuickBooks
                  </Badge>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                  <Paper withBorder radius="md" p="md">
                    <Group gap="sm" mb="sm" wrap="nowrap">
                      <ThemeIcon variant="light" color="teal" radius="md" size="lg">
                        <IconTruckDelivery size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          Ship to
                        </Text>
                        <Text size="xs" c="dimmed">
                          Where the work happens
                        </Text>
                      </div>
                    </Group>
                    <AddressFields hideLabel label="Ship to" value={form.shipTo} onChange={(v) => setForm({ ...form, shipTo: v })} />
                  </Paper>
                  <Paper withBorder radius="md" p="md">
                    <Group gap="sm" mb="sm" wrap="nowrap">
                      <ThemeIcon variant="light" color="orange" radius="md" size="lg">
                        <IconReceipt2 size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          Bill to
                        </Text>
                        <Text size="xs" c="dimmed">
                          Who pays the invoice
                        </Text>
                      </div>
                    </Group>
                    <AddressFields hideLabel label="Bill to" value={form.billTo} onChange={(v) => setForm({ ...form, billTo: v })} />
                  </Paper>
                </SimpleGrid>
                {saveBar}
              </Card>
            )}
            <QuickbooksPanel deal={deal} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
