'use client';

import {
  ActionIcon,
  Anchor,
  Button,
  FileButton,
  Group,
  Image,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFile, IconPhoto, IconX } from '@tabler/icons-react';
import { useCustomFields, useFileUrl, useUploadFile, useUploadStatus } from '@/lib/api/hooks';
import type { CustomFieldDef } from '@/lib/api/customFields';

const IMAGE_MAX = 10 * 1024 * 1024; // 10 MB per image
const DOC_MAX = 25 * 1024 * 1024; // 25 MB per document
const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.ppt,.pptx,application/pdf';

/** A stored document reference (the file itself lives in object storage under `key`). */
interface StoredDoc {
  name: string;
  type: string;
  key: string;
}

export function CustomFieldsEditor({
  entity,
  values,
  onChange,
}: {
  entity: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const { data: fields = [] } = useCustomFields(entity);
  if (fields.length === 0) return null;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Custom fields
      </Text>
      {fields.map((f) => (
        <FieldInput key={f.id} entity={entity} field={f} value={values?.[f.key]} onChange={(v) => onChange(f.key, v)} />
      ))}
    </Stack>
  );
}

function FieldInput({
  entity,
  field: f,
  value: v,
  onChange,
}: {
  entity: string;
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const required = f.required || !!f.requiredFromStageId || f.requiredForWon;

  if (f.type === 'number') {
    return (
      <NumberInput
        label={f.label}
        withAsterisk={required}
        value={(v as number | undefined) ?? ''}
        onChange={(val) => onChange(val === '' ? null : val)}
      />
    );
  }
  if (f.type === 'date') {
    return (
      <TextInput
        type="date"
        label={f.label}
        withAsterisk={required}
        value={(v as string) ?? ''}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }
  if (f.type === 'select') {
    return (
      <Select
        label={f.label}
        withAsterisk={required}
        data={f.options}
        value={(v as string) ?? null}
        onChange={onChange}
        clearable
        searchable
      />
    );
  }
  if (f.type === 'image') {
    return <ImageField entity={entity} label={f.label} required={required} value={(v as string[]) ?? []} onChange={onChange} />;
  }
  if (f.type === 'document') {
    return <DocumentField entity={entity} label={f.label} required={required} value={(v as StoredDoc[]) ?? []} onChange={onChange} />;
  }
  return (
    <TextInput
      label={f.label}
      withAsterisk={required}
      value={(v as string) ?? ''}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

function NotConfigured({ label, required }: { label: string; required: boolean }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Text size="xs" c="dimmed">
        File uploads aren&apos;t set up for this workspace yet.
      </Text>
    </div>
  );
}

function ImageField({
  entity,
  label,
  required,
  value,
  onChange,
}: {
  entity: string;
  label: string;
  required: boolean;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const status = useUploadStatus();
  const upload = useUploadFile();
  if (status.data && !status.data.configured) return <NotConfigured label={label} required={required} />;

  const add = async (files: File[]) => {
    const keys: string[] = [];
    for (const file of files) {
      if (file.size > IMAGE_MAX) {
        notifications.show({ message: `${file.name} is larger than 10 MB`, color: 'red' });
        continue;
      }
      try {
        keys.push(await upload.mutateAsync({ entity, file }));
      } catch {
        notifications.show({ message: `Could not upload ${file.name}`, color: 'red' });
      }
    }
    if (keys.length) onChange([...value, ...keys]);
  };

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Group gap="xs" mb={6}>
        {value.map((key, i) => (
          <SignedImage key={key} objectKey={key} onRemove={() => onChange(value.filter((_, idx) => idx !== i))} />
        ))}
      </Group>
      <FileButton multiple accept="image/*" onChange={add}>
        {(props) => (
          <Button {...props} size="xs" variant="default" leftSection={<IconPhoto size={14} />} loading={upload.isPending}>
            Add images
          </Button>
        )}
      </FileButton>
    </div>
  );
}

function SignedImage({ objectKey, onRemove }: { objectKey: string; onRemove: () => void }) {
  const { data } = useFileUrl(objectKey);
  return (
    <div style={{ position: 'relative' }}>
      {data?.url ? (
        <Image src={data.url} w={72} h={72} radius="sm" fit="cover" />
      ) : (
        <Paper w={72} h={72} radius="sm" withBorder />
      )}
      <ActionIcon
        size="xs"
        color="red"
        variant="filled"
        style={{ position: 'absolute', top: -6, right: -6 }}
        onClick={onRemove}
        aria-label="Remove image"
      >
        <IconX size={12} />
      </ActionIcon>
    </div>
  );
}

function DocumentField({
  entity,
  label,
  required,
  value,
  onChange,
}: {
  entity: string;
  label: string;
  required: boolean;
  value: StoredDoc[];
  onChange: (v: StoredDoc[]) => void;
}) {
  const status = useUploadStatus();
  const upload = useUploadFile();
  if (status.data && !status.data.configured) return <NotConfigured label={label} required={required} />;

  const add = async (files: File[]) => {
    const docs: StoredDoc[] = [];
    for (const file of files) {
      if (file.size > DOC_MAX) {
        notifications.show({ message: `${file.name} is larger than 25 MB`, color: 'red' });
        continue;
      }
      try {
        const key = await upload.mutateAsync({ entity, file });
        docs.push({ name: file.name, type: file.type || 'application/octet-stream', key });
      } catch {
        notifications.show({ message: `Could not upload ${file.name}`, color: 'red' });
      }
    }
    if (docs.length) onChange([...value, ...docs]);
  };

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Stack gap={4} mb={6}>
        {value.map((doc, i) => (
          <SignedDoc key={doc.key} doc={doc} onRemove={() => onChange(value.filter((_, idx) => idx !== i))} />
        ))}
      </Stack>
      <FileButton multiple accept={DOC_ACCEPT} onChange={add}>
        {(props) => (
          <Button {...props} size="xs" variant="default" leftSection={<IconFile size={14} />} loading={upload.isPending}>
            Add documents
          </Button>
        )}
      </FileButton>
    </div>
  );
}

function SignedDoc({ doc, onRemove }: { doc: StoredDoc; onRemove: () => void }) {
  const { data } = useFileUrl(doc.key);
  return (
    <Paper withBorder radius="sm" px="xs" py={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <IconFile size={14} />
          {data?.url ? (
            <Anchor href={data.url} target="_blank" rel="noreferrer" size="sm" lineClamp={1}>
              {doc.name}
            </Anchor>
          ) : (
            <Text size="sm" lineClamp={1}>
              {doc.name}
            </Text>
          )}
        </Group>
        <ActionIcon size="sm" color="red" variant="subtle" onClick={onRemove} aria-label="Remove document">
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <Text size="sm" fw={500} mb={4}>
      {label}
      {required && (
        <Text span c="red">
          {' '}
          *
        </Text>
      )}
    </Text>
  );
}
