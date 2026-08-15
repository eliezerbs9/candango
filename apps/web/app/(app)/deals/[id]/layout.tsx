'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Anchor, Badge, Button, Center, Group, HoverCard, Loader, Select, Stack, Tabs, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCheck, IconMail, IconX } from '@tabler/icons-react';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { Money } from '@/components/primitives/Money';
import { DealProvider, type DealForm } from '@/components/deals/DealContext';
import { ApiError } from '@/lib/api/client';
import type { Address } from '@/components/deals/AddressFields';
import {
  useAllStages,
  useArchiveDeal,
  useCustomFields,
  useDeal,
  useLoseDeal,
  useQuickbooksStatus,
  useReopenDeal,
  useUpdateDeal,
  useWinCheck,
  useWinDeal,
} from '@/lib/api/hooks';

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function DealLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const tab = pathname?.split('/')[3] || 'overview'; // route groups don't appear in the path

  const { data: deal, isLoading } = useDeal(id);
  const { data: stages = [] } = useAllStages();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: qb } = useQuickbooksStatus();
  const { data: winCheck } = useWinCheck(id);
  const update = useUpdateDeal();
  const win = useWinDeal();
  const lose = useLoseDeal();
  const reopen = useReopenDeal();
  const archive = useArchiveDeal();
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
        tags: deal.tags ?? [],
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

  const stageOptions = stages
    .filter((s) => s.pipelineId === deal.pipelineId)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ value: s.id, label: s.name }));

  const changeStage = (stageId: string | null) => {
    if (!stageId || stageId === deal.stageId) return;
    update.mutate(
      { id: deal.id, stageId },
      { onSuccess: () => notifications.show({ message: 'Stage updated', color: 'green' }), onError: fail },
    );
  };

  const save = (override?: Partial<DealForm>) => {
    const f = { ...form, ...override };
    update.mutate(
      {
        id: deal.id,
        title: f.title,
        value: Math.round(Number(f.value || 0) * 100),
        companyId: f.companyId || '',
        primaryPersonId: f.primaryPersonId || '',
        expectedCloseDate: f.expectedCloseDate || undefined,
        shipTo: f.shipTo,
        billTo: f.billTo,
        tags: f.tags,
        customFields: f.customFields,
      },
      { onSuccess: () => notifications.show({ message: 'Deal saved', color: 'green' }), onError: fail },
    );
  };

  const saveBar = (
    <Group justify="flex-end" mt="md">
      <Button size="xs" onClick={() => save()} loading={update.isPending}>
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
            {deal.status === 'open' && !deal.archivedAt ? (
              <Select
                size="xs"
                w={180}
                data={stageOptions}
                value={deal.stageId}
                onChange={changeStage}
                allowDeselect={false}
                checkIconPosition="right"
                comboboxProps={{ withinPortal: true }}
                disabled={update.isPending}
                aria-label="Stage"
              />
            ) : (
              <Text size="sm">{stages.find((s) => s.id === deal.stageId)?.name ?? '—'}</Text>
            )}
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
              {(() => {
                const blocked = winCheck ? !winCheck.canWin : false;
                const markWon = (
                  <Button
                    color="teal"
                    disabled={blocked}
                    loading={win.isPending}
                    onClick={() => win.mutate(deal.id, { onError: fail })}
                  >
                    Mark won
                  </Button>
                );
                // When win requirements aren't met, explain why on hover (the button is disabled).
                if (!blocked) return markWon;
                return (
                  <HoverCard width={280} position="bottom-end" shadow="md" openDelay={100}>
                    <HoverCard.Target>
                      {/* span wrapper so hover still fires over the disabled button */}
                      <span style={{ display: 'inline-block' }}>{markWon}</span>
                    </HoverCard.Target>
                    <HoverCard.Dropdown>
                      <Text size="xs" fw={700} mb={6} tt="uppercase" c="dimmed">
                        Before you can mark won
                      </Text>
                      <Stack gap={6}>
                        {winCheck?.requirements.map((r) => (
                          <Group key={r.key} gap={8} wrap="nowrap" align="flex-start">
                            {r.met ? (
                              <IconCheck size={16} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0, marginTop: 2 }} />
                            ) : (
                              <IconX size={16} color="var(--mantine-color-red-6)" style={{ flexShrink: 0, marginTop: 2 }} />
                            )}
                            <Text size="sm" c={r.met ? undefined : 'dimmed'}>
                              {r.label}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    </HoverCard.Dropdown>
                  </HoverCard>
                );
              })()}
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

      <Tabs value={tab}>
        <Tabs.List>
          {tabLink('overview', 'Overview', `/deals/${id}`)}
          {dealFields.length > 0 && tabLink('custom-fields', 'Custom fields', `/deals/${id}/custom-fields`)}
          {tabLink('proposals', 'Proposals', `/deals/${id}/proposals`)}
          {tabLink('signatures', 'Signatures', `/deals/${id}/signatures`)}
          {tabLink('estimates', qb?.connected ? 'Estimates & invoices' : 'Estimates', `/deals/${id}/estimates`)}
        </Tabs.List>
      </Tabs>

      <DealProvider value={{ deal, form, setForm, save, saving: update.isPending, saveBar }}>{children}</DealProvider>
    </Stack>
  );
}
