'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Menu, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { useProfile } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth/useAuth';

export function UserMenu() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: me } = useProfile();

  const label = me?.name || me?.email || 'You';
  const initials = label.slice(0, 1).toUpperCase();

  const logout = () => {
    signOut();
    router.push('/login');
  };

  return (
    <Menu width={250} position="bottom-end" withinPortal>
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Avatar src={me?.avatarUrl ?? undefined} radius="xl" size={34} color="candango">
            {initials}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              {label}
            </Text>
            <Text size="xs" c="dimmed">
              {me?.email}
            </Text>
            {me?.role ? (
              <Badge size="xs" variant="light" mt={4} w="fit-content">
                {me.role}
              </Badge>
            ) : null}
          </Stack>
        </Menu.Label>

        <Menu.Item leftSection={<IconUser size={16} />} component={Link} href="/settings/profile">
          Your profile
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
