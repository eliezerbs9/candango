import { Badge } from '@mantine/core';
import type { DealStatus } from '@/lib/types';

const COLORS: Record<DealStatus, string> = {
  open: 'blue',
  won: 'green',
  lost: 'red',
};

export function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <Badge color={COLORS[status]} variant="light" tt="capitalize">
      {status}
    </Badge>
  );
}
