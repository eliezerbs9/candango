'use client';

import { Badge, Card, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { IconActivity, IconBuilding, IconClock, IconPlus, IconUser, IconUserCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useOrganization, useUpdateOrganization } from '@/lib/api/hooks';
import { resolveDealCard, type DealCardConfig } from '@/lib/api/types';

const OPTIONS: { key: keyof DealCardConfig; label: string; hint: string }[] = [
  { key: 'company', label: 'Company', hint: "The client company's name" },
  { key: 'primaryContact', label: 'Primary contact', hint: 'The deal’s main person' },
  { key: 'value', label: 'Value', hint: 'The deal amount' },
  { key: 'owner', label: 'Owner', hint: 'The salesperson who owns it' },
  { key: 'daysInStage', label: 'Days in stage', hint: 'How long it’s sat in the current stage' },
  { key: 'created', label: 'Created', hint: 'When the deal was created' },
  { key: 'lastActivity', label: 'Last activity', hint: 'When something last happened on it' },
  { key: 'tags', label: 'Labels', hint: 'The deal’s labels' },
];

/** Workspace control for what shows on a pipeline deal card, with a live preview. Admin-only surface. */
export function DealCardSettings() {
  const { data: org } = useOrganization();
  const update = useUpdateOrganization();
  const cfg = resolveDealCard(org?.dealCardConfig);

  const toggle = (key: keyof DealCardConfig, on: boolean) => {
    update.mutate(
      { dealCardConfig: { ...cfg, [key]: on } },
      { onError: (e) => notifications.show({ message: e instanceof ApiError ? e.message : 'Could not save', color: 'red' }) },
    );
  };

  return (
    <div>
      <Text fw={600}>Pipeline card</Text>
      <Text size="xs" c="dimmed" mb="xs">
        Choose what shows on a deal card in the pipeline.
      </Text>
      <Card withBorder radius="md" padding="lg">
        <Group align="flex-start" wrap="wrap" gap="xl">
          {/* Toggles */}
          <Stack gap="sm" style={{ flex: 1, minWidth: 200 }}>
            {OPTIONS.map((o) => (
              <Switch
                key={o.key}
                label={o.label}
                description={o.hint}
                checked={!!cfg[o.key]}
                onChange={(e) => toggle(o.key, e.currentTarget.checked)}
              />
            ))}
          </Stack>

          {/* Live preview beside them */}
          <div style={{ width: 210 }}>
            <Text size="xs" c="dimmed" mb={6}>
              Preview
            </Text>
            <CardPreview cfg={cfg} />
          </div>
        </Group>
      </Card>
    </div>
  );
}

/** A sample deal card reflecting the current toggles (mirrors DealCard's layout). */
function CardPreview({ cfg }: { cfg: ReturnType<typeof resolveDealCard> }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text fw={500} size="sm" lineClamp={2}>
        Kitchen remodel
      </Text>
      {cfg.company && (
        <Group gap={4} wrap="nowrap" mt={6} c="dimmed">
          <IconBuilding size={13} />
          <Text size="xs">Acme Co.</Text>
        </Group>
      )}
      {cfg.primaryContact && (
        <Group gap={4} wrap="nowrap" mt={2} c="dimmed">
          <IconUser size={13} />
          <Text size="xs">Jane Doe</Text>
        </Group>
      )}
      {cfg.owner && (
        <Group gap={4} wrap="nowrap" mt={2} c="dimmed">
          <IconUserCircle size={13} />
          <Text size="xs">You</Text>
        </Group>
      )}
      {cfg.tags && (
        <Group gap={4} mt={6}>
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
            hot
          </Badge>
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
            referral
          </Badge>
        </Group>
      )}
      {(cfg.daysInStage || cfg.created || cfg.lastActivity) && (
        <Group gap={10} mt={6} c="dimmed" wrap="wrap">
          {cfg.daysInStage && (
            <Group gap={3} wrap="nowrap">
              <IconClock size={12} />
              <Text size="xs">4d in stage</Text>
            </Group>
          )}
          {cfg.created && (
            <Group gap={3} wrap="nowrap">
              <IconPlus size={12} />
              <Text size="xs">2mo ago</Text>
            </Group>
          )}
          {cfg.lastActivity && (
            <Group gap={3} wrap="nowrap">
              <IconActivity size={12} />
              <Text size="xs">3d ago</Text>
            </Group>
          )}
        </Group>
      )}
      {cfg.value && (
        <Text fw={600} size="sm" mt="xs">
          $12,500.00
        </Text>
      )}
    </Paper>
  );
}
