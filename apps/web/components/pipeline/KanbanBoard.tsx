'use client';

import { DndContext, type DragEndEvent, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Button, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { StageColumn, type StageActions } from './StageColumn';
import type { ApiDeal, ApiStage } from '@/lib/api/types';

export function KanbanBoard({
  stages,
  deals,
  onMove,
  onReorderStages,
  stageActions,
  onAddStage,
}: {
  stages: ApiStage[];
  deals: ApiDeal[];
  onMove: (dealId: string, stageId: string) => void;
  onReorderStages?: (orderedStageIds: string[]) => void;
  stageActions?: Omit<StageActions, 'canMoveLeft' | 'canMoveRight'>;
  onAddStage?: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const stageIds = stages.map((s) => s.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // A stage column was dragged → reorder columns.
    if (stageIds.includes(activeId)) {
      if (activeId !== overId && stageIds.includes(overId) && onReorderStages) {
        const oldIndex = stageIds.indexOf(activeId);
        const newIndex = stageIds.indexOf(overId);
        onReorderStages(arrayMove(stageIds, oldIndex, newIndex));
      }
      return;
    }

    // Otherwise a deal card was dragged → move it to the target stage.
    const deal = deals.find((d) => d.id === activeId);
    if (deal && deal.stageId !== overId) onMove(activeId, overId);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <Group align="flex-start" wrap="nowrap" gap="md" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <SortableContext items={stageIds} strategy={horizontalListSortingStrategy}>
          {stages.map((stage, i) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={deals.filter((d) => d.stageId === stage.id)}
              actions={
                stageActions
                  ? { ...stageActions, canMoveLeft: i > 0, canMoveRight: i < stages.length - 1 }
                  : undefined
              }
            />
          ))}
        </SortableContext>
        {onAddStage ? (
          <Box w={280} miw={280}>
            <Button
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={onAddStage}
              fullWidth
              mt={28}
            >
              Add stage
            </Button>
          </Box>
        ) : null}
      </Group>
    </DndContext>
  );
}
