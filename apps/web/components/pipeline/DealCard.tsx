'use client';

import { useDraggable } from '@dnd-kit/core';
import { Card, Group, Text } from '@mantine/core';
import { Money } from '@/components/primitives/Money';
import { companyName } from '@/lib/mock/data';
import type { Deal } from '@/lib/types';

export function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes} withBorder radius="md" padding="sm">
      <Text fw={500} size="sm" lineClamp={2}>
        {deal.title}
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        {companyName(deal.companyId)}
      </Text>
      <Group justify="space-between" mt="xs">
        <Text fw={600} size="sm">
          <Money value={deal.value} currency={deal.currency} />
        </Text>
        <Text size="xs" c="dimmed">
          {deal.owner}
        </Text>
      </Group>
    </Card>
  );
}
