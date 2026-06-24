'use client';

import { Center, Group, Loader, Overlay, Paper, Text } from '@mantine/core';
import { useBusyStore } from '@/lib/ui/useBusy';

/** Global loading overlay shown while a runBusy() task is in flight. Mounted once in Providers. */
export function BusyOverlay() {
  const count = useBusyStore((s) => s.count);
  const message = useBusyStore((s) => s.message);
  if (count <= 0) return null;

  return (
    <Overlay fixed zIndex={2000} backgroundOpacity={0.45} blur={2} color="#000">
      <Center h="100vh">
        <Paper p="lg" radius="md" shadow="md" withBorder>
          <Group gap="sm">
            <Loader size="sm" />
            <Text fw={500}>{message ?? 'Working…'}</Text>
          </Group>
        </Paper>
      </Center>
    </Overlay>
  );
}
