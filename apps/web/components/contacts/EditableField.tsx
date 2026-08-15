'use client';

import { useState, type ReactNode } from 'react';
import { ActionIcon, Group, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconCheck, IconPencil } from '@tabler/icons-react';

/**
 * A read-first, inline-editable detail row: shows the value with a small **pencil** to unlock
 * editing (no input until clicked). Saves on Enter / blur / ✓; Escape cancels. Empty clears.
 */
export function EditableField({
  icon,
  label,
  value,
  display,
  onSave,
  placeholder,
  type = 'text',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** Rendered read-mode value (e.g. a mailto link); falls back to the raw value / dash. */
  display?: ReactNode;
  onSave: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const save = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onSave(draft.trim());
  };

  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" color="gray" radius="md" size="md">
        {icon}
      </ThemeIcon>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        {editing ? (
          <TextInput
            size="xs"
            type={type}
            value={draft}
            data-autofocus
            autoFocus
            placeholder={placeholder}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={save}
            rightSection={
              <ActionIcon size="xs" variant="subtle" color="teal" aria-label="Save" onMouseDown={(e) => e.preventDefault()} onClick={save}>
                <IconCheck size={13} />
              </ActionIcon>
            }
          />
        ) : (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" component="div" style={{ minWidth: 0 }}>
              {display ?? (value || <Text span c="dimmed">—</Text>)}
            </Text>
            <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Edit ${label}`} onClick={start}>
              <IconPencil size={12} />
            </ActionIcon>
          </Group>
        )}
      </div>
    </Group>
  );
}
