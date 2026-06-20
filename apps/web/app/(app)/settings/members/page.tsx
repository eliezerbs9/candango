'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconUserPlus, IconUserX } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useDeactivateUser,
  useInviteUser,
  useRoles,
  useUpdateUser,
  useUsers,
} from '@/lib/api/hooks';
import type { ApiMember } from '@/lib/api/members';

const STATUS_COLOR: Record<string, string> = { active: 'green', invited: 'yellow', deactivated: 'gray' };

export default function MembersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: members = [], isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const invite = useInviteUser();
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();

  const [opened, ctl] = useDisclosure(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const submitInvite = () => {
    if (!email.trim()) {
      notifications.show({ message: 'Email is required', color: 'red' });
      return;
    }
    invite.mutate(
      { email: email.trim(), name: name || undefined, roleId: roleId || undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Invitation created (+1 seat)', color: 'green' });
          setEmail('');
          setName('');
          setRoleId(null);
          ctl.close();
        },
        onError: fail,
      },
    );
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const columns: Column<ApiMember>[] = [
    { key: 'name', header: 'Name', render: (m) => <Text fw={500}>{m.name ?? '—'}</Text> },
    { key: 'email', header: 'Email', render: (m) => m.email },
    {
      key: 'role',
      header: 'Role',
      render: (m) =>
        isAdmin ? (
          <Select
            size="xs"
            w={130}
            data={roleOptions}
            value={m.roleId}
            placeholder="No role"
            allowDeselect={false}
            onChange={(v) => v && update.mutate({ id: m.id, roleId: v }, { onError: fail })}
          />
        ) : (
          m.role
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => (
        <Badge variant="light" color={STATUS_COLOR[m.status] ?? 'gray'}>
          {m.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m) =>
        isAdmin && m.id !== user?.id && m.status !== 'deactivated' ? (
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label="Deactivate"
            onClick={() => deactivate.mutate(m.id, { onError: fail })}
          >
            <IconUserX size={16} />
          </ActionIcon>
        ) : null,
    },
  ];

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text c="dimmed" size="sm">
          {members.length} member{members.length === 1 ? '' : 's'} · each active user is a billable seat
        </Text>
        {isAdmin ? (
          <Button leftSection={<IconUserPlus size={16} />} onClick={ctl.open}>
            Invite
          </Button>
        ) : null}
      </Group>

      <DataTable
        columns={columns}
        data={members}
        renderCard={(m) => (
          <Stack gap={2}>
            <Group justify="space-between">
              <Text fw={500}>{m.name ?? m.email}</Text>
              <Badge variant="light" color={STATUS_COLOR[m.status] ?? 'gray'}>
                {m.status}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {m.email} · {m.role}
            </Text>
          </Stack>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title="Invite a teammate">
        <Stack>
          <TextInput label="Email" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <Select label="Role" data={roleOptions} value={roleId} onChange={setRoleId} clearable />
          <Text size="xs" c="dimmed">
            +1 seat = +$30/mo on your next invoice.
          </Text>
          <Button onClick={submitInvite} loading={invite.isPending}>
            Send invite
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
