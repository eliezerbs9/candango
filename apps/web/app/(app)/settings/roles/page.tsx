'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useScopeCatalog,
  useUpdateRole,
} from '@/lib/api/hooks';
import type { ApiRole } from '@/lib/api/members';

const VISIBILITY_OPTIONS = [
  { value: 'own', label: 'Own — only records they own' },
  { value: 'team', label: 'Team — their team’s records' },
  { value: 'org', label: 'Organization — all records' },
];

export default function RolesPage() {
  const { data: roles = [], isLoading } = useRoles();
  const { data: catalog = [] } = useScopeCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const del = useDeleteRole();

  const [opened, ctl] = useDisclosure(false);
  const [editing, setEditing] = useState<ApiRole | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<string>('own');
  const [scopes, setScopes] = useState<string[]>([]);

  const labelOf = (scope: string) => catalog.find((c) => c.value === scope)?.label ?? scope;

  const openCreate = () => {
    setEditing(null);
    setName('');
    setVisibility('own');
    setScopes([]);
    ctl.open();
  };

  const openEdit = (r: ApiRole) => {
    setEditing(r);
    setName(r.name);
    setVisibility(r.visibility);
    setScopes(r.scopes);
    ctl.open();
  };

  const remove = (r: ApiRole) => {
    if (!window.confirm(`Delete the “${r.name}” role? This can't be undone.`)) return;
    del.mutate(r.id, {
      onSuccess: () => notifications.show({ message: 'Role deleted', color: 'green' }),
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
    });
  };

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const body = { name: name.trim(), visibility: visibility as ApiRole['visibility'], scopes };
    const onSuccess = () => {
      notifications.show({ message: editing ? 'Role updated' : 'Role created', color: 'green' });
      ctl.close();
    };
    const onError = (e: unknown) =>
      notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' });

    if (editing) update.mutate({ id: editing.id, ...body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Roles control what members can do and whose records they see. System roles can’t be edited.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          New role
        </Button>
      </Group>

      {roles.map((r) => (
        <Card key={r.id} withBorder radius="md" padding="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Text fw={600}>{r.name}</Text>
              {r.isSystem ? (
                <Badge variant="light" color="gray">
                  system
                </Badge>
              ) : null}
            </Group>
            <Group gap="xs">
              <Badge variant="light">visibility: {r.visibility}</Badge>
              {!r.isSystem ? (
                <Menu withinPortal position="bottom-end" shadow="sm">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="Role actions">
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(r)}>
                      Edit
                    </Menu.Item>
                    <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(r)}>
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : null}
            </Group>
          </Group>
          <Group gap={6}>
            {r.scopes.includes('*') ? (
              <Badge variant="outline" color="gray" tt="none">
                Full access
              </Badge>
            ) : r.scopes.length ? (
              r.scopes.map((s) => (
                <Badge key={s} variant="outline" color="gray" tt="none">
                  {labelOf(s)}
                </Badge>
              ))
            ) : (
              <Text size="xs" c="dimmed">
                No permissions
              </Text>
            )}
          </Group>
        </Card>
      ))}

      <Modal opened={opened} onClose={ctl.close} title={editing ? 'Edit role' : 'New role'} size="lg">
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <Select
            label="Record visibility"
            data={VISIBILITY_OPTIONS}
            value={visibility}
            onChange={(v) => setVisibility(v ?? 'own')}
            allowDeselect={false}
          />
          <div>
            <Text size="sm" fw={500} mb={6}>
              Permissions
            </Text>
            <Checkbox.Group value={scopes} onChange={setScopes}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {catalog.map((c) => (
                  <Checkbox key={c.value} value={c.value} label={c.label} />
                ))}
              </SimpleGrid>
            </Checkbox.Group>
          </div>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save changes' : 'Create role'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
