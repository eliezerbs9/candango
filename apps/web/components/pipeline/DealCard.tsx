'use client';

import { useDraggable } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { Badge, Card, Group, Text } from '@mantine/core';
import { IconActivity, IconBuilding, IconClock, IconPlus, IconUser, IconUserCircle } from '@tabler/icons-react';
import { Money } from '@/components/primitives/Money';
import { useCompanies, useOrganization, usePersons, useUsers } from '@/lib/api/hooks';
import { resolveDealCard, type ApiDeal } from '@/lib/api/types';

/** Whole days since an ISO timestamp (0 = today). */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
/** Short relative label: "today", "3d ago", "2mo ago". */
function relative(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return 'today';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function DealCard({ deal }: { deal: ApiDeal }) {
  const router = useRouter();
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const { data: users = [] } = useUsers();
  const { data: org } = useOrganization();
  const cfg = resolveDealCard(org?.dealCardConfig);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  const company = deal.companyId ? companies.find((c) => c.id === deal.companyId) : null;
  const person = deal.primaryPersonId ? persons.find((p) => p.id === deal.primaryPersonId) : null;
  const owner = users.find((u) => u.id === deal.ownerUserId);

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      // A click without drag movement opens the deal page (dnd-kit only starts a
      // drag past the 5px activation distance, so plain clicks fall through here).
      onClick={() => router.push(`/deals/${deal.id}`)}
      withBorder
      radius="md"
      padding="sm"
    >
      <Text fw={500} size="sm" lineClamp={2}>
        {deal.title}
      </Text>

      {cfg.company && company && (
        <Group gap={4} wrap="nowrap" mt={6} c="dimmed">
          <IconBuilding size={13} />
          <Text size="xs" truncate>
            {company.name}
          </Text>
        </Group>
      )}
      {cfg.primaryContact && person && (
        <Group gap={4} wrap="nowrap" mt={2} c="dimmed">
          <IconUser size={13} />
          <Text size="xs" truncate>
            {person.name}
          </Text>
        </Group>
      )}
      {cfg.owner && owner && (
        <Group gap={4} wrap="nowrap" mt={2} c="dimmed">
          <IconUserCircle size={13} />
          <Text size="xs" truncate>
            {owner.name}
          </Text>
        </Group>
      )}

      {cfg.tags && deal.tags.length > 0 && (
        <Group gap={4} mt={6}>
          {deal.tags.map((t) => (
            <Badge key={t} size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
              {t}
            </Badge>
          ))}
        </Group>
      )}

      {(cfg.daysInStage || cfg.created || cfg.lastActivity) && (
        <Group gap={10} mt={6} c="dimmed" wrap="wrap">
          {cfg.daysInStage && (
            <Group gap={3} wrap="nowrap">
              <IconClock size={12} />
              <Text size="xs">{daysSince(deal.stageChangedAt)}d in stage</Text>
            </Group>
          )}
          {cfg.created && (
            <Group gap={3} wrap="nowrap">
              <IconPlus size={12} />
              <Text size="xs">{relative(deal.createdAt)}</Text>
            </Group>
          )}
          {cfg.lastActivity && (
            <Group gap={3} wrap="nowrap">
              <IconActivity size={12} />
              <Text size="xs">{deal.lastActivityAt ? relative(deal.lastActivityAt) : 'no activity'}</Text>
            </Group>
          )}
        </Group>
      )}

      {cfg.value && (
        <Text fw={600} size="sm" mt="xs">
          <Money value={deal.value} currency={deal.currency} />
        </Text>
      )}
    </Card>
  );
}
