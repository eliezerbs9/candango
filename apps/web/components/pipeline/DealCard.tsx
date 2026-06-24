'use client';

import { useDraggable } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { Card, Group, Text } from '@mantine/core';
import { IconBuilding, IconUser } from '@tabler/icons-react';
import { Money } from '@/components/primitives/Money';
import { useCompanies, usePersons } from '@/lib/api/hooks';
import type { ApiDeal } from '@/lib/api/types';

export function DealCard({ deal }: { deal: ApiDeal }) {
  const router = useRouter();
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  const company = deal.companyId ? companies.find((c) => c.id === deal.companyId) : null;
  const person = deal.primaryPersonId ? persons.find((p) => p.id === deal.primaryPersonId) : null;

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

      {company && (
        <Group gap={4} wrap="nowrap" mt={6} c="dimmed">
          <IconBuilding size={13} />
          <Text size="xs" truncate>
            {company.name}
          </Text>
        </Group>
      )}
      {person && (
        <Group gap={4} wrap="nowrap" mt={2} c="dimmed">
          <IconUser size={13} />
          <Text size="xs" truncate>
            {person.name}
          </Text>
        </Group>
      )}

      <Text fw={600} size="sm" mt="xs">
        <Money value={deal.value} currency={deal.currency} />
      </Text>
    </Card>
  );
}
