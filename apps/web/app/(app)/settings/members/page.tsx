'use client';

import { Badge, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconUserPlus } from '@tabler/icons-react';
import { DataTable, type Column } from '@/components/data/DataTable';
import { users, type OrgUser } from '@/lib/mock/admin';

const columns: Column<OrgUser>[] = [
  { key: 'name', header: 'Name', render: (u) => <Text fw={500}>{u.name}</Text> },
  { key: 'email', header: 'Email', render: (u) => u.email },
  { key: 'role', header: 'Role', render: (u) => u.role },
  {
    key: 'status',
    header: 'Status',
    render: (u) => (
      <Badge variant="light" color={u.status === 'active' ? 'green' : 'yellow'}>
        {u.status}
      </Badge>
    ),
  },
];

export default function MembersPage() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text c="dimmed" size="sm">
          {users.length} members · each active user is a billable seat
        </Text>
        <Button leftSection={<IconUserPlus size={16} />} onClick={open}>
          Invite
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={users}
        renderCard={(u) => (
          <Stack gap={2}>
            <Text fw={500}>{u.name}</Text>
            <Text size="sm" c="dimmed">
              {u.email} · {u.role}
            </Text>
          </Stack>
        )}
      />

      <Modal opened={opened} onClose={close} title="Invite a teammate" fullScreen={false}>
        <Stack>
          <TextInput label="Email" placeholder="teammate@company.com" />
          <Text size="xs" c="dimmed">
            +1 seat = +$30/mo on your next invoice.
          </Text>
          <Button
            onClick={() => {
              notifications.show({ message: 'Invitation sent', color: 'green' });
              close();
            }}
          >
            Send invite
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
