'use client';

import { useDraggable } from '@dnd-kit/core';
import { Card, Text } from '@mantine/core';
import { Money } from '@/components/primitives/Money';
import type { ApiDeal } from '@/lib/api/types';

export function DealCard({ deal }: { deal: ApiDeal }) {
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
      <Text fw={600} size="sm" mt="xs">
        <Money value={deal.value} currency={deal.currency} />
      </Text>
    </Card>
  );
}
