'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconLock, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { useAllStages, useCreateCustomField, useCustomFieldSchema, useDeleteCustomField } from '@/lib/api/hooks';
import type { CustomFieldDef, CustomFieldType, SystemFieldDef } from '@/lib/api/customFields';

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  image: 'Image',
  document: 'Document',
};

const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as CustomFieldType[]).map((v) => ({ value: v, label: TYPE_LABEL[v] }));

export default function FieldsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [entity, setEntity] = useState('deal');
  const { data: schema, isLoading } = useCustomFieldSchema(entity);
  const { data: stages = [] } = useAllStages();
  const create = useCreateCustomField();
  const del = useDeleteCustomField();

  const [opened, ctl] = useDisclosure(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [required, setRequired] = useState(false);
  const [requiredFromStageId, setRequiredFromStageId] = useState<string | null>(null);
  const [requiredForWon, setRequiredForWon] = useState(false);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const openCreate = () => {
    setLabel('');
    setType('text');
    setOptions([]);
    setRequired(false);
    setRequiredFromStageId(null);
    setRequiredForWon(false);
    ctl.open();
  };

  const submit = () => {
    if (!label.trim()) {
      notifications.show({ message: 'Label is required', color: 'red' });
      return;
    }
    create.mutate(
      {
        entity,
        label: label.trim(),
        type,
        options: type === 'select' ? options : undefined,
        required,
        ...(entity === 'deal' ? { requiredFromStageId, requiredForWon } : {}),
      },
      {
        onSuccess: () => {
          notifications.show({ message: 'Field added', color: 'green' });
          ctl.close();
        },
        onError: fail,
      },
    );
  };

  if (!isAdmin) {
    return (
      <Text c="dimmed" size="sm">
        Only admins can manage fields.
      </Text>
    );
  }

  const stageName = (id: string | null) => (id ? stages.find((s) => s.id === id)?.name ?? 'a stage' : null);

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
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          New field
        </Button>
      </Group>

      {isLoading || !schema ? (
        <Center mih="20vh">
          <Loader />
        </Center>
      ) : (
        <Stack gap="lg">
          {/* Essential (built-in) fields — always present, can't be changed */}
          <FieldSection title="Essential fields" description="Built into every record — always present.">
            {schema.system.map((f) => (
              <SystemRow key={f.key} field={f} />
            ))}
          </FieldSection>

          {/* Integration fields — only when the integration is connected */}
          {schema.integration.length > 0 && (
            <FieldSection title="Integration fields" description="Kept in sync by a connected integration.">
              {schema.integration.map((f) => (
                <SystemRow key={f.key} field={f} />
              ))}
            </FieldSection>
          )}

          {/* Custom fields — admin-defined, editable */}
          <FieldSection
            title="Custom fields"
            description={`Your own fields stored on each ${entity}. Available in the API too.`}
          >
            {schema.custom.length === 0 ? (
              <Text c="dimmed" size="sm">
                No custom fields yet.
              </Text>
            ) : (
              schema.custom.map((f) => (
                <CustomRow key={f.id} field={f} stageName={stageName} onDelete={() => del.mutate(f.id, { onError: fail })} />
              ))
            )}
          </FieldSection>
        </Stack>
      )}

      <Modal opened={opened} onClose={ctl.close} title={`New ${entity} field`}>
        <Stack>
          <TextInput label="Label" required value={label} onChange={(e) => setLabel(e.currentTarget.value)} data-autofocus />
          <Select
            label="Type"
            data={TYPE_OPTIONS}
            value={type}
            onChange={(v) => setType((v as CustomFieldType) ?? 'text')}
            allowDeselect={false}
            description={
              type === 'image'
                ? 'Upload one or more images (e.g. inspection photos).'
                : type === 'document'
                  ? 'Attach documents — PDF, Word, text and other common files.'
                  : undefined
            }
          />
          {type === 'select' && (
            <TagsInput label="Options" placeholder="Type an option and press Enter" value={options} onChange={setOptions} />
          )}

          <Switch
            label="Required"
            checked={required}
            onChange={(e) => setRequired(e.currentTarget.checked)}
          />

          {entity === 'deal' && (
            <>
              <Select
                label="Required from stage"
                description="Becomes required once the deal reaches this stage (or later)."
                placeholder="Any stage — not stage-gated"
                clearable
                data={stages.map((s) => ({ value: s.id, label: s.name }))}
                value={requiredFromStageId}
                onChange={setRequiredFromStageId}
              />
              <Switch
                label="Required to mark the deal Won"
                checked={requiredForWon}
                onChange={(e) => setRequiredForWon(e.currentTarget.checked)}
              />
            </>
          )}

          <Button onClick={submit} loading={create.isPending}>
            Add field
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Text fw={600}>{title}</Text>
      <Text size="xs" c="dimmed" mb="xs">
        {description}
      </Text>
      <Card withBorder radius="md" padding="xs">
        <Stack gap={4}>{children}</Stack>
      </Card>
    </div>
  );
}

function SystemRow({ field }: { field: SystemFieldDef }) {
  return (
    <Group justify="space-between" wrap="nowrap" px="xs" py={6}>
      <Group gap="xs" wrap="nowrap">
        <IconLock size={14} color="var(--mantine-color-gray-5)" />
        <Text size="sm">{field.label}</Text>
        {field.integration === 'quickbooks' && (
          <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
            QuickBooks
          </Badge>
        )}
      </Group>
      <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
        {field.type}
      </Badge>
    </Group>
  );
}

function CustomRow({
  field,
  stageName,
  onDelete,
}: {
  field: CustomFieldDef;
  stageName: (id: string | null) => string | null;
  onDelete: () => void;
}) {
  const reqNotes: string[] = [];
  if (field.required) reqNotes.push('required');
  if (field.requiredFromStageId) reqNotes.push(`required from ${stageName(field.requiredFromStageId)}`);
  if (field.requiredForWon) reqNotes.push('required to win');

  return (
    <Group justify="space-between" wrap="nowrap" px="xs" py={6}>
      <div style={{ minWidth: 0 }}>
        <Group gap={6} wrap="wrap" align="center">
          <Text size="sm" fw={500}>
            {field.label}
          </Text>
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
            {TYPE_LABEL[field.type] ?? field.type}
          </Badge>
          {reqNotes.map((n) => (
            <Badge key={n} size="xs" variant="light" color="orange" style={{ textTransform: 'none' }}>
              {n}
            </Badge>
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          key: {field.key}
          {field.type === 'select' && field.options.length ? ` · ${field.options.join(', ')}` : ''}
        </Text>
      </div>
      <ActionIcon variant="subtle" color="red" aria-label="Delete" onClick={onDelete}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}
