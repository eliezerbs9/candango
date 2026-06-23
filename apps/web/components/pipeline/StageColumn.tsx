'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Box, Group, Menu, Paper, Stack, Text } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconDots,
  IconGripVertical,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { DealCard } from './DealCard';
import { Money } from '@/components/primitives/Money';
import type { ApiDeal, ApiStage } from '@/lib/api/types';

export interface StageActions {
  onRename: (stage: ApiStage) => void;
  onDelete: (stage: ApiStage) => void;
  onMove: (stage: ApiStage, dir: -1 | 1) => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

export function StageColumn({
  stage,
  deals,
  actions,
}: {
  stage: ApiStage;
  deals: ApiDeal[];
  actions?: StageActions;
}) {
  const sortable = useSortable({ id: stage.id });
  const { setNodeRef, transform, transition, isOver, isDragging, attributes, listeners } = sortable;
  const total = deals.reduce((sum, d) => sum + d.value, 0);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} w={280} miw={280}>
      <Group justify="space-between" mb="xs" px={4} wrap="nowrap">
        <Group gap={4} wrap="nowrap">
          {actions ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              style={{ cursor: 'grab', touchAction: 'none' }}
              aria-label="Drag to reorder stage"
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size={15} />
            </ActionIcon>
          ) : null}
          <Text fw={600} size="sm" truncate>
            {stage.name}{' '}
            <Text span c="dimmed" size="xs">
              ({deals.length})
            </Text>
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">
            <Money value={total} />
          </Text>
          {actions ? (
            <Menu withinPortal position="bottom-end" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Stage actions">
                  <IconDots size={15} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => actions.onRename(stage)}>
                  Rename
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconArrowLeft size={14} />}
                  disabled={!actions.canMoveLeft}
                  onClick={() => actions.onMove(stage, -1)}
                >
                  Move left
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconArrowRight size={14} />}
                  disabled={!actions.canMoveRight}
                  onClick={() => actions.onMove(stage, 1)}
                >
                  Move right
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => actions.onDelete(stage)}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null}
        </Group>
      </Group>
      <Paper
        bg={isOver ? 'candango.0' : 'gray.0'}
        p="xs"
        radius="md"
        mih={400}
        style={{ transition: 'background 120ms' }}
      >
        <Stack gap="xs">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
