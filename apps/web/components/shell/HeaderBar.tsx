'use client';

import { ActionIcon, Burger, Group, Text, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { Logo } from '@/components/brand/Logo';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/lib/auth/useAuth';

export function HeaderBar({ opened, onBurger }: { opened: boolean; onBurger: () => void }) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { user } = useAuth();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group gap="sm">
        <Burger opened={opened} onClick={onBurger} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
        <Logo size={22} />
      </Group>
      <Group gap="md">
        {user?.orgName ? (
          <Text size="sm" c="dimmed" fw={500} visibleFrom="sm">
            {user.orgName}
          </Text>
        ) : null}
        <ActionIcon
          variant="default"
          size="lg"
          onClick={toggleColorScheme}
          aria-label="Toggle color scheme"
        >
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <UserMenu />
      </Group>
    </Group>
  );
}
