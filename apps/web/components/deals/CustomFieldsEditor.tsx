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
import { useCustomFields } from '@/lib/api/hooks';
import type { CustomFieldDef } from '@/lib/api/customFields';

const IMAGE_MAX = 4 * 1024 * 1024; // 4 MB per image
const DOC_MAX = 8 * 1024 * 1024; // 8 MB per document
const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.ppt,.pptx,application/pdf';

interface StoredDoc {
  name: string;
  type: string;
  url: string; // data URL
}

const readDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

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
        <FieldInput key={f.id} field={f} value={values?.[f.key]} onChange={(v) => onChange(f.key, v)} />
      ))}
    </Stack>
  );
}

function FieldInput({
  field: f,
  value: v,
  onChange,
}: {
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
    return <ImageField label={f.label} required={required} value={(v as string[]) ?? []} onChange={onChange} />;
  }
  if (f.type === 'document') {
    return <DocumentField label={f.label} required={required} value={(v as StoredDoc[]) ?? []} onChange={onChange} />;
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

function ImageField({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const add = async (files: File[]) => {
    const ok = files.filter((file) => {
      if (file.size > IMAGE_MAX) {
        notifications.show({ message: `${file.name} is larger than 4 MB`, color: 'red' });
        return false;
      }
      return true;
    });
    const urls = await Promise.all(ok.map(readDataUrl));
    onChange([...value, ...urls]);
  };
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Group gap="xs" mb={6}>
        {value.map((url, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <Image src={url} w={72} h={72} radius="sm" fit="cover" />
            <ActionIcon
              size="xs"
              color="red"
              variant="filled"
              style={{ position: 'absolute', top: -6, right: -6 }}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label="Remove image"
            >
              <IconX size={12} />
            </ActionIcon>
          </div>
        ))}
      </Group>
      <FileButton multiple accept="image/*" onChange={add}>
        {(props) => (
          <Button {...props} size="xs" variant="default" leftSection={<IconPhoto size={14} />}>
            Add images
          </Button>
        )}
      </FileButton>
    </div>
  );
}

function DocumentField({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: StoredDoc[];
  onChange: (v: StoredDoc[]) => void;
}) {
  const add = async (files: File[]) => {
    const ok = files.filter((file) => {
      if (file.size > DOC_MAX) {
        notifications.show({ message: `${file.name} is larger than 8 MB`, color: 'red' });
        return false;
      }
      return true;
    });
    const docs = await Promise.all(
      ok.map(async (file) => ({ name: file.name, type: file.type || 'application/octet-stream', url: await readDataUrl(file) })),
    );
    onChange([...value, ...docs]);
  };
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Stack gap={4} mb={6}>
        {value.map((doc, i) => (
          <Paper key={i} withBorder radius="sm" px="xs" py={4}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <IconFile size={14} />
                <Anchor href={doc.url} download={doc.name} size="sm" lineClamp={1}>
                  {doc.name}
                </Anchor>
              </Group>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label="Remove document"
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
      </Stack>
      <FileButton multiple accept={DOC_ACCEPT} onChange={add}>
        {(props) => (
          <Button {...props} size="xs" variant="default" leftSection={<IconFile size={14} />}>
            Add documents
          </Button>
        )}
      </FileButton>
    </div>
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
