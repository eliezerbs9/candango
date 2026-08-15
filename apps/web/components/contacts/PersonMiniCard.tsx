'use client';

import Link from 'next/link';
import { ActionIcon, Anchor, Group, Paper, Tooltip } from '@mantine/core';
import { IconStar, IconX } from '@tabler/icons-react';

/**
 * A small person card shared everywhere a person is listed as a card (company Contacts & roles,
 * deal participants, …) so they stay visually consistent — they're the same entity. Renders the
 * bordered card + a linked, tooltipped name + an optional ★ (primary) and ✕ (remove); the caller
 * supplies the body (email, role input, affiliation, phone, …) as children.
 */
export function PersonMiniCard({
  id,
  name,
  isPrimary = false,
  primaryTooltip,
  onSetPrimary,
  onRemove,
  style,
  children,
}: {
  id: string;
  name: string;
  isPrimary?: boolean;
  primaryTooltip?: string;
  onSetPrimary?: () => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p={8} style={style}>
      <Group justify="space-between" wrap="nowrap" gap={2}>
        <Tooltip label={name} withArrow openDelay={400}>
          <Anchor component={Link} href={`/contacts/people/${id}`} size="xs" fw={600} lineClamp={1}>
            {name}
          </Anchor>
        </Tooltip>
        <Group gap={0} wrap="nowrap">
          {onSetPrimary && (
            <Tooltip label={primaryTooltip ?? (isPrimary ? 'Primary contact' : 'Set as primary')} withArrow>
              <ActionIcon
                variant={isPrimary ? 'filled' : 'subtle'}
                color="candango"
                radius="xl"
                size="xs"
                aria-label="Set as primary contact"
                onClick={onSetPrimary}
              >
                <IconStar size={11} />
              </ActionIcon>
            </Tooltip>
          )}
          {onRemove && (
            <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Remove ${name}`} onClick={onRemove}>
              <IconX size={12} />
            </ActionIcon>
          )}
        </Group>
      </Group>
      {children}
    </Paper>
  );
}
