'use client';

import { useState } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StageColumn } from './StageColumn';
import type { Deal, Stage } from '@/lib/types';

export function KanbanBoard({ stages, initialDeals }: { stages: Stage[]; initialDeals: Deal[] }) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetStageId = String(over.id);

    setDeals((current) =>
      current.map((d) =>
        d.id === active.id && d.stageId !== targetStageId
          ? { ...d, stageId: targetStageId, stageChangedAt: new Date(0).toISOString() }
          : d,
      ),
    );
    // Optimistic UI: in production this PATCHes /deals/{id}; rollback on error.
    notifications.show({ message: 'Deal moved', color: 'green', autoClose: 1200 });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <Group align="flex-start" wrap="nowrap" gap="md" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} deals={deals.filter((d) => d.stageId === stage.id)} />
        ))}
      </Group>
    </DndContext>
  );
}
