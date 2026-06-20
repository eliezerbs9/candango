'use client';

import { ActionIcon, Burger, Group, Title, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export function HeaderBar({ opened, onBurger }: { opened: boolean; onBurger: () => void }) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group gap="sm">
        <Burger opened={opened} onClick={onBurger} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
        <Title order={4} c="indigo.6">
          Candango
        </Title>
      </Group>
      <ActionIcon
        variant="default"
        size="lg"
        onClick={toggleColorScheme}
        aria-label="Toggle color scheme"
      >
        {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Group>
  );
}
