'use client';

import { useDroppable } from '@dnd-kit/core';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { DealCard } from './DealCard';
import { Money } from '@/components/primitives/Money';
import type { ApiDeal, ApiStage } from '@/lib/api/types';

export function StageColumn({ stage, deals }: { stage: ApiStage; deals: ApiDeal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <Box w={280} miw={280}>
      <Group justify="space-between" mb="xs" px={4}>
        <Text fw={600} size="sm">
          {stage.name}{' '}
          <Text span c="dimmed" size="xs">
            ({deals.length})
          </Text>
        </Text>
        <Text size="xs" c="dimmed">
          <Money value={total} />
        </Text>
      </Group>
      <Paper
        ref={setNodeRef}
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
