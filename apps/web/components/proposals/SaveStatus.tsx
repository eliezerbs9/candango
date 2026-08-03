import { Group, Loader, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { AutosaveStatus } from '@/lib/useAutosave';

/** Small "Saving… / All changes saved" indicator for the autosaving editors. */
export function SaveStatus({ status }: { status: AutosaveStatus }) {
  if (status === 'saving') {
    return (
      <Group gap={6} wrap="nowrap">
        <Loader size={14} />
        <Text size="sm" c="dimmed">
          Saving…
        </Text>
      </Group>
    );
  }
  if (status === 'saved') {
    return (
      <Group gap={4} wrap="nowrap">
        <IconCheck size={15} color="var(--mantine-color-teal-6)" />
        <Text size="sm" c="dimmed">
          All changes saved
        </Text>
      </Group>
    );
  }
  return (
    <Text size="sm" c="dimmed">
      Autosaves
    </Text>
  );
}
