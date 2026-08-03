'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  ColorInput,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconPalette,
  IconTrash,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useProposalMeta, useProposalTemplate, useUpdateProposalTemplate } from '@/lib/api/hooks';
import type { ProposalBlockType, ProposalRow, ProposalTheme } from '@/lib/api/proposals';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const equalCols = (n: number, blocks: (ProposalRow['columns'][number]['block'])[] = []) =>
  Array.from({ length: n }, (_, i) => ({ id: uid(), width: Math.round(12 / n), block: blocks[i] ?? null }));

export default function ProposalTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useProposalTemplate(id);
  const { data: meta } = useProposalMeta();
  const update = useUpdateProposalTemplate();

  const [name, setName] = useState('');
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [themeOpen, themeCtl] = useDisclosure(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setTheme(template.theme);
    setRows(template.layout ?? []);
  }, [template]);

  if (isLoading || !template || !theme) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  const blockLabel = (t: ProposalBlockType) => meta?.blocks.find((b) => b.type === t)?.label ?? t;
  const blockOptions = (meta?.blocks ?? []).map((b) => ({ value: b.type, label: b.label }));

  const setRow = (rowId: string, fn: (r: ProposalRow) => ProposalRow) =>
    setRows((rs) => rs.map((r) => (r.id === rowId ? fn(r) : r)));
  const addRow = () => setRows((rs) => [...rs, { id: uid(), columns: equalCols(1) }]);
  const removeRow = (rowId: string) => setRows((rs) => rs.filter((r) => r.id !== rowId));
  const moveRow = (rowId: string, dir: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === rowId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const setColumnCount = (rowId: string, n: number) =>
    setRow(rowId, (r) => ({ ...r, columns: equalCols(n, r.columns.map((c) => c.block)) }));
  const setBlockType = (rowId: string, colId: string, type: ProposalBlockType | null) =>
    setRow(rowId, (r) => ({
      ...r,
      columns: r.columns.map((c) => (c.id === colId ? { ...c, block: type ? { type, props: {} } : null } : c)),
    }));
  const setBlockProp = (rowId: string, colId: string, key: string, value: unknown) =>
    setRow(rowId, (r) => ({
      ...r,
      columns: r.columns.map((c) =>
        c.id === colId && c.block ? { ...c, block: { ...c.block, props: { ...c.block.props, [key]: value } } } : c,
      ),
    }));

  const save = () =>
    update.mutate(
      { id: template.id, body: { name: name.trim(), theme, layout: rows } },
      { onSuccess: () => notifications.show({ message: 'Template saved', color: 'green' }), onError: fail },
    );

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/settings/proposals" c="dimmed" size="sm">
        <Group gap={4} wrap="nowrap">
          <IconArrowLeft size={14} /> Proposal templates
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput
          label="Template name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          style={{ flex: '1 1 280px' }}
        />
        <Group gap="xs">
          <Button variant="default" leftSection={<IconPalette size={16} />} onClick={themeCtl.open}>
            Theme
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={update.isPending}>
            Save
          </Button>
        </Group>
      </Group>

      {/* Canvas — the layout of rows → columns (areas) → block */}
      <Stack gap="sm">
        {rows.map((row, ri) => (
          <Card key={row.id} withBorder radius="md" padding="sm">
            <Group justify="space-between" mb="xs">
              <SegmentedControl
                size="xs"
                data={[
                  { value: '1', label: '1 column' },
                  { value: '2', label: '2 columns' },
                  { value: '3', label: '3 columns' },
                ]}
                value={String(row.columns.length)}
                onChange={(v) => setColumnCount(row.id, Number(v))}
              />
              <Group gap={2}>
                <ActionIcon variant="subtle" color="gray" disabled={ri === 0} onClick={() => moveRow(row.id, -1)} aria-label="Move up">
                  <IconChevronUp size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" disabled={ri === rows.length - 1} onClick={() => moveRow(row.id, 1)} aria-label="Move down">
                  <IconChevronDown size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => removeRow(row.id)} aria-label="Remove row">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>

            <Group align="stretch" gap="xs" wrap="nowrap">
              {row.columns.map((c) => (
                <Paper key={c.id} withBorder radius="sm" p="xs" style={{ flex: c.width, minWidth: 0 }}>
                  {c.block ? (
                    <Stack gap={6}>
                      <Group justify="space-between" wrap="nowrap">
                        <Badge variant="light" color="candango" style={{ textTransform: 'none' }}>
                          {blockLabel(c.block.type)}
                        </Badge>
                        <Group gap={2} wrap="nowrap">
                          <Select
                            size="xs"
                            w={120}
                            data={blockOptions}
                            value={c.block.type}
                            onChange={(v) => setBlockType(row.id, c.id, (v as ProposalBlockType) ?? c.block!.type)}
                            allowDeselect={false}
                          />
                          <ActionIcon variant="subtle" color="red" onClick={() => setBlockType(row.id, c.id, null)} aria-label="Remove block">
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                      <BlockSettings
                        type={c.block.type}
                        props={c.block.props}
                        onChange={(k, val) => setBlockProp(row.id, c.id, k, val)}
                      />
                    </Stack>
                  ) : (
                    <Select
                      size="xs"
                      placeholder="Add a block"
                      data={blockOptions}
                      value={null}
                      onChange={(v) => v && setBlockType(row.id, c.id, v as ProposalBlockType)}
                    />
                  )}
                </Paper>
              ))}
            </Group>
          </Card>
        ))}

        <Button variant="light" onClick={addRow}>
          + Add row
        </Button>
      </Stack>

      <ThemeModal opened={themeOpen} onClose={themeCtl.close} theme={theme} fonts={meta?.fonts ?? []} onChange={setTheme} />
    </Stack>
  );
}

function BlockSettings({
  type,
  props,
  onChange,
}: {
  type: ProposalBlockType;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (type === 'cover') {
    return (
      <Stack gap={6}>
        <TextInput size="xs" placeholder="Title (supports {{variables}})" value={(props.title as string) ?? ''} onChange={(e) => onChange('title', e.currentTarget.value)} />
        <TextInput size="xs" placeholder="Subtitle" value={(props.subtitle as string) ?? ''} onChange={(e) => onChange('subtitle', e.currentTarget.value)} />
      </Stack>
    );
  }
  if (type === 'text') {
    return (
      <Textarea size="xs" autosize minRows={2} maxRows={8} placeholder="Text (HTML + {{variables}})" value={(props.html as string) ?? ''} onChange={(e) => onChange('html', e.currentTarget.value)} />
    );
  }
  if (type === 'image') {
    return (
      <TextInput size="xs" label="Image field key (optional)" description="Which image custom field to pull from at build time — leave blank to choose per proposal." value={(props.fieldKey as string) ?? ''} onChange={(e) => onChange('fieldKey', e.currentTarget.value)} />
    );
  }
  if (type === 'document') {
    return (
      <TextInput size="xs" label="Document field key (optional)" description="Which document custom field to attach — leave blank to choose per proposal." value={(props.fieldKey as string) ?? ''} onChange={(e) => onChange('fieldKey', e.currentTarget.value)} />
    );
  }
  return (
    <Text size="xs" c="dimmed">
      Shows the estimate line items + totals selected when building the proposal.
    </Text>
  );
}

function ThemeModal({
  opened,
  onClose,
  theme,
  fonts,
  onChange,
}: {
  opened: boolean;
  onClose: () => void;
  theme: ProposalTheme;
  fonts: string[];
  onChange: (t: ProposalTheme) => void;
}) {
  const set = (patch: Partial<ProposalTheme>) => onChange({ ...theme, ...patch });
  return (
    <Modal opened={opened} onClose={onClose} title="Theme" centered>
      <Stack>
        <ColorInput label="Primary color" value={theme.primaryColor} onChange={(v) => set({ primaryColor: v })} />
        <ColorInput label="Accent color" value={theme.accentColor} onChange={(v) => set({ accentColor: v })} />
        <Select label="Heading font" data={fonts} value={theme.fontHeading} onChange={(v) => set({ fontHeading: v ?? theme.fontHeading })} allowDeselect={false} />
        <Select label="Body font" data={fonts} value={theme.fontBody} onChange={(v) => set({ fontBody: v ?? theme.fontBody })} allowDeselect={false} />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Cover style
          </Text>
          <SegmentedControl
            data={[
              { value: 'solid', label: 'Solid color' },
              { value: 'image', label: 'Background image' },
            ]}
            value={theme.coverStyle}
            onChange={(v) => set({ coverStyle: v as ProposalTheme['coverStyle'] })}
          />
        </div>
        <Button onClick={onClose}>Done</Button>
      </Stack>
    </Modal>
  );
}
