'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconChevronDown, IconChevronUp, IconLayoutGrid, IconPlus, IconTrash } from '@tabler/icons-react';
import { DocCard, ImageCard, docIcon, type StoredDoc } from '@/components/deals/CustomFieldsEditor';
import { useDeal, useFileUrl, useSignableDocuments, useUpdateDeal, useUploadFile } from '@/lib/api/hooks';
import type { ProposalFieldDef, ProposalFieldType } from '@/lib/api/proposals';

const TYPE_OPTIONS: { value: ProposalFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'image', label: 'Image' },
  { value: 'document', label: 'Document' },
  { value: 'signature_template', label: 'Signature document' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'invoice', label: 'Invoice' },
];

const COUNTABLE: ProposalFieldType[] = ['document', 'image', 'estimate', 'invoice'];

let seq = 0;
const newKey = (label: string) =>
  `${(label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field')}_${Date.now().toString(36)}${seq++}`;


/* ────────────────────────── Template editor: define the internal fields ────────────────────────── */

type FieldOpt = { value: string; label: string };

export function ProposalFieldDefsEditor({
  value,
  onChange,
  imageFields = [],
  documentFields = [],
  qbConnected = false,
}: {
  value: ProposalFieldDef[];
  onChange: (fields: ProposalFieldDef[]) => void;
  /** The deal's image/document custom fields — a document/image internal field binds to one of these. */
  imageFields?: FieldOpt[];
  documentFields?: FieldOpt[];
  /** Show a QuickBooks indicator on the estimate/invoice type options. */
  qbConnected?: boolean;
}) {
  const fields = value ?? [];
  const patch = (i: number, p: Partial<ProposalFieldDef>) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  // Switching type resets the binding/label so document/image pick a custom field, others get a free label.
  const changeType = (i: number, type: ProposalFieldType) => {
    const isRef = type === 'document' || type === 'image';
    const cur = fields[i];
    patch(i, {
      type,
      customFieldKey: undefined,
      ...(isRef ? { label: '' } : {}),
      // Give estimate/invoice a default label so an unlabelled field isn't silently dropped on save.
      ...(!isRef && (type === 'estimate' || type === 'invoice') && !cur.label ? { label: type === 'estimate' ? 'Estimate' : 'Invoice' } : {}),
    });
  };
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...fields, { key: newKey('field'), label: '', type: 'signature_template', required: true }]);

  return (
    <Card withBorder radius="md" padding="sm">
      <Text size="sm" fw={600}>
        Internal fields
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        Filled by your team per proposal, <strong>hidden from the client</strong> — they drive automations (e.g. a required
        <em> Signature document</em> sent for signature when the proposal is accepted).
      </Text>

      <Stack gap="xs">
        {fields.map((f, i) => (
          <Paper key={f.key} withBorder radius="sm" p="xs">
            <Group gap={4} justify="space-between" wrap="nowrap" mb={4}>
              <Group gap={2} wrap="nowrap">
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <IconChevronUp size={14} />
                </ActionIcon>
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down">
                  <IconChevronDown size={14} />
                </ActionIcon>
              </Group>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => remove(i)} aria-label="Remove field">
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
            <Stack gap={6}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Select
                  size="xs"
                  data={TYPE_OPTIONS}
                  value={f.type}
                  onChange={(v) => changeType(i, (v as ProposalFieldType) ?? 'text')}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: true }}
                  style={{ flex: '1 1 auto' }}
                  renderOption={({ option }) => (
                    <Group gap={6} wrap="nowrap">
                      <span>{option.label}</span>
                      {qbConnected && (option.value === 'estimate' || option.value === 'invoice') && (
                        <Badge size="xs" radius="sm" color="green" variant="light" title="Syncs with QuickBooks">
                          QB
                        </Badge>
                      )}
                    </Group>
                  )}
                />
                <Switch size="xs" label="Required" checked={!!f.required} onChange={(e) => patch(i, { required: e.currentTarget.checked })} />
              </Group>
              {f.type === 'document' || f.type === 'image' ? (
                <Select
                  size="xs"
                  label="Deal field to fill"
                  description={`The rep uploads into this deal ${f.type} field.`}
                  placeholder={f.type === 'image' ? 'Pick an Image Field' : 'Pick a Document Field'}
                  data={f.type === 'image' ? imageFields : documentFields}
                  value={f.customFieldKey ?? null}
                  onChange={(v) => {
                    const opt = (f.type === 'image' ? imageFields : documentFields).find((o) => o.value === v);
                    patch(i, { customFieldKey: v ?? undefined, label: opt?.label ?? '' });
                  }}
                  searchable
                  comboboxProps={{ withinPortal: true }}
                  nothingFoundMessage={`No ${f.type} custom fields — add one on the Fields page`}
                />
              ) : (
                <TextInput size="xs" placeholder="Label (e.g. Agreement)" value={f.label} onChange={(e) => patch(i, { label: e.currentTarget.value })} />
              )}
              {f.type === 'select' && (
                <TextInput
                  size="xs"
                  placeholder="Options: A, B, C"
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) => patch(i, { options: e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                />
              )}
              {COUNTABLE.includes(f.type) && (
                <Switch
                  size="xs"
                  label="Allow multiple"
                  description={f.multiple === false ? 'Exactly one — the proposal can’t be sent with more.' : undefined}
                  checked={f.multiple !== false}
                  onChange={(e) => patch(i, { multiple: e.currentTarget.checked })}
                />
              )}
            </Stack>
          </Paper>
        ))}
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={add} style={{ alignSelf: 'flex-start' }}>
          Add field
        </Button>
      </Stack>
    </Card>
  );
}

/* ────────────────────────── Deal builder: the rep fills the internal fields ────────────────────────── */

export function ProposalFieldsFiller({
  dealId,
  fields,
  values,
  onChange,
  pricingCounts,
  renderPricingField,
}: {
  dealId: string;
  fields: ProposalFieldDef[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** How many estimates/invoices the proposal references (union) — for estimate/invoice status rows. */
  pricingCounts: { estimate: number; invoice: number };
  /** Deal builder: an editable estimate/invoice picker (add existing / create) for an estimate/invoice field. */
  renderPricingField?: (field: ProposalFieldDef, value: unknown, onChange: (v: unknown) => void) => ReactNode;
}) {
  if (!fields || fields.length === 0) return null;
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <Card withBorder radius="md" padding="sm">
      <Text size="sm" fw={600}>
        Internal fields
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Only your team sees these — never on the client&apos;s proposal. Required ones must be filled before you can send.
      </Text>
      <Stack gap="sm">
        {fields.map((f) => (
          <FieldInput
            key={f.key}
            dealId={dealId}
            field={f}
            value={values?.[f.key]}
            onChange={(v) => set(f.key, v)}
            pricingCounts={pricingCounts}
            renderPricingField={renderPricingField}
          />
        ))}
      </Stack>
    </Card>
  );
}

/** Read-only status for an estimate/invoice field — its value comes from the proposal's Pricing elements. */
function PricingFieldStatus({ field: f, count }: { field: ProposalFieldDef; count: number }) {
  const noun = f.type === 'estimate' ? 'estimate' : 'invoice';
  const ok = (!f.required || count > 0) && !(f.multiple === false && count > 1);
  return (
    <div>
      <FieldLabel f={f} />
      <Text size="xs" c={ok ? 'dimmed' : 'red'}>
        {count === 0
          ? `No ${noun} yet — add one in a Pricing element.`
          : `${count} ${noun}${count > 1 ? 's' : ''} from the Pricing element${count > 1 ? 's' : ''}.`}
        {f.multiple === false && count > 1 ? ` Only one ${noun} allowed.` : ''}
      </Text>
    </div>
  );
}

type PoolItem = { key: string; name?: string; type?: string };

/**
 * A document/image internal field bound to a deal custom field. The deal keeps ALL its files; the proposal
 * SELECTS which are linked (stored in fieldValues — a key for single, an array for multiple). Selected files
 * render as the same cards as the deal's Custom-fields tab; "Select from deal" opens a picker, "Upload" adds
 * to the deal field.
 */
function DealFileField({
  dealId,
  field: f,
  value,
  onSelect,
}: {
  dealId: string;
  field: ProposalFieldDef;
  value: unknown;
  onSelect: (v: unknown) => void;
}) {
  const { data: deal } = useDeal(dealId);
  const update = useUpdateDeal();
  const upload = useUploadFile();
  const [pick, pickCtl] = useDisclosure(false);
  const key = f.customFieldKey;
  const isImage = f.type === 'image';
  const isMulti = f.multiple !== false;

  const cf = (deal?.customFields ?? {}) as Record<string, unknown>;
  const pool: (string | StoredDoc)[] = key ? ((cf[key] as (string | StoredDoc)[]) ?? []) : [];
  const poolItems: PoolItem[] = pool.map((x) => (typeof x === 'string' ? { key: x } : { key: x.key, name: x.name, type: x.type }));
  const poolKeys = poolItems.map((p) => p.key);

  const selected: string[] = isMulti
    ? Array.isArray(value)
      ? (value as unknown[]).filter((k): k is string => typeof k === 'string')
      : []
    : typeof value === 'string' && value
      ? [value]
      : [];
  const validSelected = selected.filter((k) => poolKeys.includes(k));

  const setSelected = (keys: string[]) => onSelect(isMulti ? keys : (keys[0] ?? ''));

  // Auto-select when the deal has exactly one file and nothing is chosen yet.
  useEffect(() => {
    if (poolKeys.length === 1 && validSelected.length === 0) setSelected([poolKeys[0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKeys.length, validSelected.length]);

  if (!key) {
    return (
      <div>
        <FieldLabel f={f} />
        <Text size="xs" c="red">
          Not linked to a deal field — set it on the proposal template.
        </Text>
      </div>
    );
  }

  const docFor = (k: string): StoredDoc => {
    const p = poolItems.find((x) => x.key === k);
    return { key: k, name: p?.name ?? 'File', type: p?.type ?? '' };
  };

  const addToDeal = async (files: File[]) => {
    const added: (string | StoredDoc)[] = [];
    const newKeys: string[] = [];
    for (const file of files) {
      try {
        const k = await upload.mutateAsync({ entity: 'deal', file });
        added.push(isImage ? k : { name: file.name, type: file.type || 'application/octet-stream', key: k });
        newKeys.push(k);
      } catch {
        notifications.show({ message: `Could not upload ${file.name}`, color: 'red' });
      }
    }
    if (added.length) {
      update.mutate({ id: dealId, customFields: { ...cf, [key]: [...pool, ...added] } });
      setSelected(isMulti ? [...validSelected, ...newKeys] : newKeys.slice(-1)); // auto-link the uploaded files
    }
  };

  return (
    <div>
      <FieldLabel f={f} />
      {validSelected.length > 0 && (
        <Group gap="xs" mt={4} wrap="wrap">
          {validSelected.map((k) =>
            isImage ? (
              <ImageCard key={k} objectKey={k} onRemove={() => setSelected(validSelected.filter((x) => x !== k))} />
            ) : (
              <DocCard key={k} doc={docFor(k)} onRemove={() => setSelected(validSelected.filter((x) => x !== k))} />
            ),
          )}
        </Group>
      )}
      <Group gap="xs" mt={6}>
        <Button size="xs" variant="light" leftSection={<IconLayoutGrid size={13} />} onClick={pickCtl.open}>
          {validSelected.length ? 'Change selection' : 'Select from deal'}
        </Button>
        <FileButton multiple accept={isImage ? 'image/*' : undefined} onChange={addToDeal}>
          {(props) => (
            <Button {...props} size="xs" variant="subtle" leftSection={<IconPlus size={13} />} loading={upload.isPending}>
              {isImage ? 'Upload image' : 'Upload file'}
            </Button>
          )}
        </FileButton>
      </Group>
      <FilePickModal
        opened={pick}
        onClose={pickCtl.close}
        title={f.label}
        isImage={isImage}
        multi={isMulti}
        items={poolItems}
        selected={validSelected}
        onConfirm={(keys) => {
          setSelected(keys);
          pickCtl.close();
        }}
      />
    </div>
  );
}

/** Modal to pick which of the deal field's files are linked to the proposal (single or multiple). */
function FilePickModal({
  opened,
  onClose,
  title,
  isImage,
  multi,
  items,
  selected,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  isImage: boolean;
  multi: boolean;
  items: PoolItem[];
  selected: string[];
  onConfirm: (keys: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(selected);
  useEffect(() => {
    if (opened) setSel(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const toggle = (k: string) => {
    if (!multi) {
      onConfirm([k]);
      return;
    }
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Select for “${title}”`} size="lg">
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No files on the deal yet — upload one first.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
          {items.map((it) => (
            <SelectTile key={it.key} item={it} isImage={isImage} selected={sel.includes(it.key)} onClick={() => toggle(it.key)} />
          ))}
        </SimpleGrid>
      )}
      {multi && (
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(sel)}>Done ({sel.length})</Button>
        </Group>
      )}
    </Modal>
  );
}

/** A selectable file tile in the pick modal — image thumbnail or a doc icon, with a checkmark when selected. */
function SelectTile({ item, isImage, selected, onClick }: { item: PoolItem; isImage: boolean; selected: boolean; onClick: () => void }) {
  const { data } = useFileUrl(item.key);
  const { Icon, color } = docIcon(item.name ?? '', item.type ?? '');
  return (
    <Paper
      withBorder
      radius="md"
      p={isImage ? 0 : 'xs'}
      onClick={onClick}
      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', outline: selected ? '2px solid var(--mantine-color-candango-6)' : undefined }}
    >
      {isImage ? (
        data?.url ? <Image src={data.url} h={90} fit="cover" /> : <Paper h={90} bg="var(--mantine-color-gray-1)" />
      ) : (
        <Stack gap={4} align="center">
          <ThemeIcon variant="light" color={color} size={36} radius="md">
            <Icon size={22} />
          </ThemeIcon>
          <Text size="xs" ta="center" lineClamp={2} title={item.name}>
            {item.name ?? 'File'}
          </Text>
        </Stack>
      )}
      {selected && (
        <ThemeIcon color="candango" size={20} radius="xl" style={{ position: 'absolute', top: 4, right: 4 }}>
          <IconCheck size={12} />
        </ThemeIcon>
      )}
    </Paper>
  );
}

function FieldLabel({ f }: { f: ProposalFieldDef }) {
  return (
    <Text size="sm" fw={500}>
      {f.label}
      {f.required && (
        <Text span c="red">
          {' '}
          *
        </Text>
      )}
    </Text>
  );
}

function FieldInput({
  dealId,
  field: f,
  value: v,
  onChange,
  pricingCounts,
  renderPricingField,
}: {
  dealId: string;
  field: ProposalFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  pricingCounts: { estimate: number; invoice: number };
  renderPricingField?: (field: ProposalFieldDef, value: unknown, onChange: (v: unknown) => void) => ReactNode;
}) {
  const { data: signableDocs = [] } = useSignableDocuments();

  if (f.type === 'estimate' || f.type === 'invoice') {
    // Deal builder: editable picker (add existing / create). Fallback: read-only status (template preview).
    if (renderPricingField) {
      return (
        <div>
          <FieldLabel f={f} />
          {renderPricingField(f, v, onChange)}
        </div>
      );
    }
    return <PricingFieldStatus field={f} count={f.type === 'estimate' ? pricingCounts.estimate : pricingCounts.invoice} />;
  }

  if (f.type === 'number') {
    return <NumberInput label={f.label} withAsterisk={f.required} value={(v as number | undefined) ?? ''} onChange={(val) => onChange(val === '' ? null : val)} />;
  }
  if (f.type === 'date') {
    return <TextInput type="date" label={f.label} withAsterisk={f.required} value={(v as string) ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
  if (f.type === 'select') {
    return <Select label={f.label} withAsterisk={f.required} data={f.options ?? []} value={(v as string) ?? null} onChange={onChange} clearable searchable />;
  }
  if (f.type === 'signature_template') {
    const opts = signableDocs.filter((d) => d.dealId === null).map((d) => ({ value: d.id, label: d.name }));
    return (
      <Select
        label={f.label}
        withAsterisk={f.required}
        placeholder="Pick a signature document template"
        data={opts}
        value={(v as string) ?? null}
        onChange={onChange}
        searchable
        clearable
        nothingFoundMessage="No document templates — create one in Settings → Signatures"
        comboboxProps={{ withinPortal: true }}
      />
    );
  }
  if (f.type === 'image' || f.type === 'document') {
    // Bound to a deal custom field: the deal keeps ALL its files, the proposal selects which are linked.
    return <DealFileField dealId={dealId} field={f} value={v} onSelect={onChange} />;
  }
  return <TextInput label={f.label} withAsterisk={f.required} value={(v as string) ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
}

