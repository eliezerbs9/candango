'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Anchor, Badge, Button, Center, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconMail } from '@tabler/icons-react';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { Money } from '@/components/primitives/Money';
import { WinConvertModal } from '@/components/deals/quickbooks/WinConvertModal';
import { DealProvider, type DealForm } from '@/components/deals/DealContext';
import { ApiError } from '@/lib/api/client';
import type { Address } from '@/components/deals/AddressFields';
import {
  useAllStages,
  useArchiveDeal,
  useCustomFields,
  useDeal,
  useDealEstimates,
  useLoseDeal,
  useQuickbooksStatus,
  useReopenDeal,
  useUpdateDeal,
  useWinDeal,
} from '@/lib/api/hooks';

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function DealLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const tab = pathname?.split('/')[3] || 'overview'; // route groups don't appear in the path

  const { data: deal, isLoading } = useDeal(id);
  const { data: stages = [] } = useAllStages();
  const { data: dealEstimates = [] } = useDealEstimates(id);
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdateDeal();
  const win = useWinDeal();
  const lose = useLoseDeal();
  const reopen = useReopenDeal();
  const archive = useArchiveDeal();
  const [emailOpen, emailCtl] = useDisclosure(false);
  const [winConvertOpen, winConvertCtl] = useDisclosure(false);

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
      { onSuccess: () => notifications.show({ message: 'Deal saved', color: 'green' }), onError: fail },
    );
  };

  const saveBar = (
    <Group justify="flex-end" mt="md">
      <Button size="xs" onClick={save} loading={update.isPending}>
        Save changes
      </Button>
    </Group>
  );

  const tabLink = (value: string, label: ReactNode, href: string) => (
    <Tabs.Tab value={value} renderRoot={(props) => <Link href={href} {...props} />}>
      {label}
    </Tabs.Tab>
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

      <ComposeEmail opened={emailOpen} onClose={emailCtl.close} defaultDealId={deal.id} />
      <WinConvertModal dealId={deal.id} currency={deal.currency} opened={winConvertOpen} onClose={winConvertCtl.close} />

      <Tabs value={tab}>
        <Tabs.List>
          {tabLink('overview', 'Overview', `/deals/${id}`)}
          {dealFields.length > 0 && tabLink('custom-fields', 'Custom fields', `/deals/${id}/custom-fields`)}
          {tabLink('proposals', 'Proposals', `/deals/${id}/proposals`)}
          {tabLink('estimates', qb?.connected ? 'Estimates & invoices' : 'Estimates', `/deals/${id}/estimates`)}
        </Tabs.List>
      </Tabs>

      <DealProvider value={{ deal, form, setForm, save, saving: update.isPending, saveBar }}>{children}</DealProvider>
    </Stack>
  );
}
