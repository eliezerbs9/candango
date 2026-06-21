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
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { useCreateCustomField, useCustomFields, useDeleteCustomField } from '@/lib/api/hooks';
import type { CustomFieldType } from '@/lib/api/customFields';

export default function CustomFieldsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [entity, setEntity] = useState('deal');
  const { data: fields = [], isLoading } = useCustomFields(entity);
  const create = useCreateCustomField();
  const del = useDeleteCustomField();

  const [opened, ctl] = useDisclosure(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const submit = () => {
    if (!label.trim()) {
      notifications.show({ message: 'Label is required', color: 'red' });
      return;
    }
    create.mutate(
      { entity, label: label.trim(), type, options: type === 'select' ? options : undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Field added', color: 'green' });
          setLabel('');
          setType('text');
          setOptions([]);
          ctl.close();
        },
        onError: fail,
      },
    );
  };

  if (!isAdmin) {
    return (
      <Text c="dimmed" size="sm">
        Only admins can manage custom fields.
      </Text>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={entity}
          onChange={setEntity}
          data={[
            { value: 'deal', label: 'Deals' },
            { value: 'person', label: 'People' },
            { value: 'company', label: 'Companies' },
          ]}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={ctl.open}>
          Add field
        </Button>
      </Group>

      <Text c="dimmed" size="sm">
        Admin-defined fields stored on each {entity}&apos;s record (great for external integrations).
      </Text>

      {isLoading ? (
        <Center mih="20vh">
          <Loader />
        </Center>
      ) : fields.length === 0 ? (
        <Text c="dimmed" size="sm">
          No custom fields for {entity} yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {fields.map((f) => (
            <Group key={f.id} justify="space-between" wrap="nowrap">
              <div>
                <Text fw={500}>
                  {f.label}{' '}
                  <Badge size="xs" variant="light" ml={6}>
                    {f.type}
                  </Badge>
                </Text>
                <Text size="xs" c="dimmed">
                  key: {f.key}
                  {f.type === 'select' && f.options.length ? ` · ${f.options.join(', ')}` : ''}
                </Text>
              </div>
              <ActionIcon variant="subtle" color="red" aria-label="Delete" onClick={() => del.mutate(f.id, { onError: fail })}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}

      <Modal opened={opened} onClose={ctl.close} title={`Add ${entity} field`}>
        <Stack>
          <TextInput label="Label" required value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
          <Select
            label="Type"
            data={['text', 'number', 'date', 'select']}
            value={type}
            onChange={(v) => setType((v as CustomFieldType) ?? 'text')}
            allowDeselect={false}
          />
          {type === 'select' ? (
            <TagsInput label="Options" placeholder="Type an option and press Enter" value={options} onChange={setOptions} />
          ) : null}
          <Button onClick={submit} loading={create.isPending}>
            Add field
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
