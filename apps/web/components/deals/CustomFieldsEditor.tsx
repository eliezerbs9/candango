'use client';

import type { ComponentType } from 'react';
import {
  ActionIcon,
  Anchor,
  Button,
  FileButton,
  Divider,
  Group,
  Image,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconFile,
  IconFileTypeCsv,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeTxt,
  IconFileTypeXls,
  IconPhoto,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import {
  useCompanies,
  useCreateCompany,
  useCreatePerson,
  useCustomFields,
  useFileUrl,
  usePersons,
  useUploadFile,
  useUploadStatus,
} from '@/lib/api/hooks';
import { compressImage } from '@/lib/imageCompress';
import { type Address } from '@/components/deals/AddressFields';
import { AddressInput } from '@/components/deals/AddressInput';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import type { CustomFieldDef } from '@/lib/api/customFields';

const IMAGE_MAX = 10 * 1024 * 1024;
/** Human-readable size for the "optimized" notice. */
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const DOC_MAX = 25 * 1024 * 1024;
const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.ppt,.pptx,application/pdf';
const PREVIEW_COUNT = 5;

export interface StoredDoc {
  name: string;
  type: string;
  key: string;
}

/** Pick a file-type icon + colour from the filename/mime. */
export function docIcon(name: string, type: string): { Icon: ComponentType<{ size?: number }>; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const t = type.toLowerCase();
  if (ext === 'pdf' || t.includes('pdf')) return { Icon: IconFileTypePdf, color: 'red' };
  if (ext === 'doc' || ext === 'docx' || t.includes('word')) return { Icon: IconFileTypeDocx, color: 'blue' };
  if (ext === 'csv') return { Icon: IconFileTypeCsv, color: 'teal' };
  if (ext === 'xls' || ext === 'xlsx' || t.includes('sheet') || t.includes('excel')) return { Icon: IconFileTypeXls, color: 'green' };
  if (ext === 'ppt' || ext === 'pptx' || t.includes('presentation')) return { Icon: IconFileTypePpt, color: 'orange' };
  if (ext === 'txt' || ext === 'rtf' || t.startsWith('text')) return { Icon: IconFileTypeTxt, color: 'gray' };
  return { Icon: IconFile, color: 'gray' };
}

export function CustomFieldsEditor({
  entity,
  values,
  onChange,
  onCommit,
}: {
  entity: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Called (besides onChange) when a FILE field (image/document) changes, so an upload/removal
   *  persists immediately instead of waiting for a manual Save. Optional — omit for manual-save only. */
  onCommit?: (key: string, value: unknown) => void;
}) {
  const { data: fields = [] } = useCustomFields(entity);
  if (fields.length === 0) return null;

  return (
    <Stack gap="sm">
      <Divider label="Custom fields" labelPosition="left" />
      {fields.map((f) => (
        <FieldInput
          key={f.id}
          entity={entity}
          field={f}
          value={values?.[f.key]}
          onChange={(v) => onChange(f.key, v)}
          commit={onCommit ? (v) => onCommit(f.key, v) : undefined}
        />
      ))}
    </Stack>
  );
}

function FieldInput({
  entity,
  field: f,
  value: v,
  onChange,
  commit,
}: {
  entity: string;
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  commit?: (value: unknown) => void;
}) {
  const required = f.required || !!f.requiredFromStageId || f.requiredForWon;

  if (f.type === 'number') {
    return (
      <NumberInput label={f.label} withAsterisk={required} value={(v as number | undefined) ?? ''} onChange={(val) => onChange(val === '' ? null : val)} />
    );
  }
  if (f.type === 'date') {
    return <TextInput type="date" label={f.label} withAsterisk={required} value={(v as string) ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
  if (f.type === 'select') {
    return (
      <Select label={f.label} withAsterisk={required} data={f.options} value={(v as string) ?? null} onChange={onChange} clearable searchable />
    );
  }
  if (f.type === 'image') {
    return <ImageField entity={entity} label={f.label} required={required} value={(v as string[]) ?? []} onChange={onChange} commit={commit} />;
  }
  if (f.type === 'document') {
    return <DocumentField entity={entity} label={f.label} required={required} value={(v as StoredDoc[]) ?? []} onChange={onChange} commit={commit} />;
  }
  if (f.type === 'address') {
    // Clean collapsed address: summary + Edit when set, "Add address" when empty (no name/attention line).
    return <AddressInput label={f.label} required={required} value={(v as Address) ?? {}} onChange={onChange} />;
  }
  if (f.type === 'person') {
    return <PersonRefField label={f.label + (required ? ' *' : '')} value={(v as string) ?? null} onChange={onChange} />;
  }
  if (f.type === 'company') {
    return <CompanyRefField label={f.label + (required ? ' *' : '')} value={(v as string) ?? null} onChange={onChange} />;
  }
  return <TextInput label={f.label} withAsterisk={required} value={(v as string) ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
}

/** A custom field that references a contact (Person) — pick or create; stores the person id. */
function PersonRefField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: unknown) => void }) {
  const { data: persons = [] } = usePersons();
  const createPerson = useCreatePerson();
  const personCreate = usePersonCreate({
    create: async ({ firstName, lastName }) => {
      const p = await createPerson.mutateAsync({ firstName, lastName });
      return { value: p.id, label: p.name };
    },
  });
  return (
    <>
      <CreatableSelect
        label={label}
        placeholder="Search or create a contact"
        options={persons.map((p) => ({ value: p.id, label: p.name }))}
        value={value}
        onChange={onChange}
        onCreate={personCreate.prompt}
      />
      {personCreate.modal}
    </>
  );
}

/** A custom field that references a Company — pick or create; stores the company id. */
function CompanyRefField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: unknown) => void }) {
  const { data: companies = [] } = useCompanies();
  const createCompany = useCreateCompany();
  return (
    <CreatableSelect
      label={label}
      placeholder="Search or create a company"
      options={companies.map((c) => ({ value: c.id, label: c.name }))}
      value={value}
      onChange={onChange}
      onCreate={async (name) => {
        const c = await createCompany.mutateAsync({ name });
        return { value: c.id, label: c.name };
      }}
    />
  );
}

// ── Images ───────────────────────────────────────────────────────────────────
function ImageField({
  entity,
  label,
  required,
  value,
  onChange,
  commit,
}: {
  entity: string;
  label: string;
  required: boolean;
  value: string[];
  onChange: (v: string[]) => void;
  commit?: (v: string[]) => void;
}) {
  const status = useUploadStatus();
  const upload = useUploadFile();
  const [viewAll, viewAllCtl] = useDisclosure(false);
  if (status.data && !status.data.configured) return <NotConfigured label={label} required={required} />;

  // Apply a new value locally AND persist it immediately (files shouldn't need a manual Save).
  const apply = (next: string[]) => {
    onChange(next);
    commit?.(next);
  };

  const add = async (files: File[]) => {
    const keys: string[] = [];
    let before = 0;
    let after = 0;
    for (const raw of files) {
      // Compress up front so the 10 MB cap is checked against what actually gets stored — a 12 MB
      // photo that shrinks to 800 KB should be accepted. `uploadFile` compresses too, but this file
      // is already marked as handled, so it isn't re-encoded.
      const file = await compressImage(raw);
      if (file.size > IMAGE_MAX) {
        notifications.show({ message: `${raw.name} is larger than 10 MB`, color: 'red' });
        continue;
      }
      try {
        keys.push(await upload.mutateAsync({ entity, file }));
        before += raw.size;
        after += file.size;
      } catch {
        notifications.show({ message: `Could not upload ${raw.name}`, color: 'red' });
      }
    }
    if (keys.length) apply([...value, ...keys]);
    // Only worth saying when the saving is real; silent for small files.
    if (before - after > 1024 * 1024) {
      notifications.show({ message: `Photos optimized — ${mb(before)} → ${mb(after)}`, color: 'green' });
    }
  };
  const remove = (i: number) => apply(value.filter((_, idx) => idx !== i));

  return (
    <FieldFrame
      label={label}
      required={required}
      count={value.length}
      onViewAll={value.length > PREVIEW_COUNT ? viewAllCtl.open : undefined}
    >
      <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars="x">
        <Group gap="xs" wrap="nowrap" pb={value.length > PREVIEW_COUNT ? 6 : 0}>
          {value.slice(0, PREVIEW_COUNT).map((key, i) => (
            <ImageCard key={key} objectKey={key} onRemove={() => remove(i)} />
          ))}
          <AddCard onChange={add} loading={upload.isPending} accept="image/*" icon={<IconPhoto size={18} />} label="Add" />
        </Group>
      </ScrollArea>

      <Modal opened={viewAll} onClose={viewAllCtl.close} title={label} size="lg">
        <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
          {value.map((key, i) => (
            <ImageCard key={key} objectKey={key} onRemove={() => remove(i)} big />
          ))}
        </SimpleGrid>
      </Modal>
    </FieldFrame>
  );
}

export function ImageCard({ objectKey, onRemove, big }: { objectKey: string; onRemove: () => void; big?: boolean }) {
  const { data } = useFileUrl(objectKey);
  const size = big ? '100%' : 84;
  return (
    <Paper withBorder radius="md" style={{ position: 'relative', overflow: 'hidden', flex: '0 0 auto' }}>
      <Anchor href={data?.url} target="_blank" rel="noreferrer">
        {data?.url ? (
          <Image src={data.url} w={size} h={big ? 96 : 84} fit="cover" />
        ) : (
          <Paper w={size} h={big ? 96 : 84} bg="var(--mantine-color-gray-1)" />
        )}
      </Anchor>
      <ActionIcon
        size="xs"
        color="red"
        variant="filled"
        style={{ position: 'absolute', top: 4, right: 4 }}
        onClick={onRemove}
        aria-label="Remove image"
      >
        <IconX size={12} />
      </ActionIcon>
    </Paper>
  );
}

// ── Documents ──────────────────────────────────────────────────────────────────
function DocumentField({
  entity,
  label,
  required,
  value,
  onChange,
  commit,
}: {
  entity: string;
  label: string;
  required: boolean;
  value: StoredDoc[];
  onChange: (v: StoredDoc[]) => void;
  commit?: (v: StoredDoc[]) => void;
}) {
  const status = useUploadStatus();
  const upload = useUploadFile();
  const [viewAll, viewAllCtl] = useDisclosure(false);
  if (status.data && !status.data.configured) return <NotConfigured label={label} required={required} />;

  // Apply a new value locally AND persist it immediately (files shouldn't need a manual Save).
  const apply = (next: StoredDoc[]) => {
    onChange(next);
    commit?.(next);
  };

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
    if (docs.length) apply([...value, ...docs]);
  };
  const remove = (i: number) => apply(value.filter((_, idx) => idx !== i));

  return (
    <FieldFrame
      label={label}
      required={required}
      count={value.length}
      onViewAll={value.length > PREVIEW_COUNT ? viewAllCtl.open : undefined}
    >
      <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars="x">
        <Group gap="xs" wrap="nowrap" pb={value.length > PREVIEW_COUNT ? 6 : 0}>
          {value.slice(0, PREVIEW_COUNT).map((doc, i) => (
            <DocCard key={doc.key} doc={doc} onRemove={() => remove(i)} />
          ))}
          <AddCard onChange={add} loading={upload.isPending} accept={DOC_ACCEPT} icon={<IconPlus size={18} />} label="Add" />
        </Group>
      </ScrollArea>

      <Modal opened={viewAll} onClose={viewAllCtl.close} title={label} size="lg">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
          {value.map((doc, i) => (
            <DocCard key={doc.key} doc={doc} onRemove={() => remove(i)} full />
          ))}
        </SimpleGrid>
      </Modal>
    </FieldFrame>
  );
}

export function DocCard({ doc, onRemove, full }: { doc: StoredDoc; onRemove: () => void; full?: boolean }) {
  const { data } = useFileUrl(doc.key);
  const { Icon, color } = docIcon(doc.name, doc.type);
  return (
    <Paper withBorder radius="md" p="xs" style={{ position: 'relative', width: full ? '100%' : 116, flex: '0 0 auto' }}>
      <Anchor href={data?.url} target="_blank" rel="noreferrer" underline="never" c="inherit">
        <Stack gap={6} align="center">
          <ThemeIcon variant="light" color={color} size={40} radius="md">
            <Icon size={24} />
          </ThemeIcon>
          <Text size="xs" ta="center" lineClamp={2} title={doc.name} style={{ wordBreak: 'break-word' }}>
            {doc.name}
          </Text>
        </Stack>
      </Anchor>
      <ActionIcon
        size="xs"
        color="red"
        variant="subtle"
        style={{ position: 'absolute', top: 2, right: 2 }}
        onClick={onRemove}
        aria-label="Remove document"
      >
        <IconX size={12} />
      </ActionIcon>
    </Paper>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────────
function FieldFrame({
  label,
  required,
  count,
  onViewAll,
  children,
}: {
  label: string;
  required: boolean;
  count: number;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Group justify="space-between" align="center" mb={4}>
        <FieldLabel label={label} required={required} />
        {onViewAll && (
          <Button variant="subtle" size="compact-xs" onClick={onViewAll}>
            View all ({count})
          </Button>
        )}
      </Group>
      {children}
    </div>
  );
}

function AddCard({
  onChange,
  loading,
  accept,
  icon,
  label,
}: {
  onChange: (files: File[]) => void;
  loading: boolean;
  accept: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <FileButton multiple accept={accept} onChange={onChange}>
      {(props) => (
        <Paper
          {...props}
          withBorder
          radius="md"
          w={84}
          h={84}
          style={{ flex: '0 0 auto', cursor: 'pointer', borderStyle: 'dashed', opacity: loading ? 0.6 : 1 }}
        >
          <Stack gap={2} align="center" justify="center" h="100%" c="dimmed">
            {icon}
            <Text size="xs">{loading ? 'Uploading…' : label}</Text>
          </Stack>
        </Paper>
      )}
    </FileButton>
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

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <Text size="sm" fw={500}>
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
