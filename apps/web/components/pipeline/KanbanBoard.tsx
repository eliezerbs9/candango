'use client';

import { DndContext, type DragEndEvent, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { Group } from '@mantine/core';
import { StageColumn } from './StageColumn';
import type { ApiDeal, ApiStage } from '@/lib/api/types';

export function KanbanBoard({
  stages,
  deals,
  onMove,
}: {
  stages: ApiStage[];
  deals: ApiDeal[];
  onMove: (dealId: string, stageId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const stageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stageId !== stageId) onMove(dealId, stageId);
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
