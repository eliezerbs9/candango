'use client';

import { useEffect, useMemo, useState } from 'react';
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
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEye,
  IconGripVertical,
  IconPalette,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useProposalMeta, useProposalTemplate, useTemplateVariables, useUpdateProposalTemplate } from '@/lib/api/hooks';
import type { ProposalBlockType, ProposalColumn, ProposalPage, ProposalTheme } from '@/lib/api/proposals';
import { ProposalRenderer, toPages } from '@/components/proposals/ProposalRenderer';
import { buildPreviewCtx } from '@/components/proposals/previewCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const ROW_PRESETS = [
  { value: '12', label: '1 column', widths: [12] },
  { value: '6-6', label: '2 · equal', widths: [6, 6] },
  { value: '8-4', label: '2 · wide + narrow', widths: [8, 4] },
  { value: '4-8', label: '2 · narrow + wide', widths: [4, 8] },
  { value: '4-4-4', label: '3 columns', widths: [4, 4, 4] },
];
const cols = (widths: number[], blocks: (ProposalColumn['block'])[] = []): ProposalColumn[] =>
  widths.map((w, i) => ({ id: uid(), width: w, block: blocks[i] ?? null }));
const blankRow = () => ({ id: uid(), columns: cols([12]) });

export default function ProposalTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useProposalTemplate(id);
  const { data: meta } = useProposalMeta();
  const { data: variables = [] } = useTemplateVariables();
  const update = useUpdateProposalTemplate();

  const [name, setName] = useState('');
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [pages, setPages] = useState<ProposalPage[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [sel, setSel] = useState<{ rowId: string; colId: string } | null>(null);
  const [themeOpen, themeCtl] = useDisclosure(false);
  const [previewOpen, previewCtl] = useDisclosure(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setTheme(template.theme);
    const p = toPages(template.layout);
    const init = p.length ? p : [{ id: uid(), rows: [blankRow()] }];
    setPages(init);
    setPageId(init[0].id);
  }, [template]);

  const page = useMemo(() => pages.find((p) => p.id === pageId) ?? null, [pages, pageId]);

  if (isLoading || !template || !theme) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  // ── mutators ──
  const setPage = (pid: string, fn: (p: ProposalPage) => ProposalPage) =>
    setPages((ps) => ps.map((p) => (p.id === pid ? fn(p) : p)));
  const addPage = () => {
    const np = { id: uid(), rows: [blankRow()] };
    setPages((ps) => [...ps, np]);
    setPageId(np.id);
  };
  const removePage = (pid: string) =>
    setPages((ps) => {
      const next = ps.filter((p) => p.id !== pid);
      if (pid === pageId) setPageId(next[0]?.id ?? null);
      return next.length ? next : [{ id: uid(), rows: [blankRow()] }];
    });
  const addRow = () => page && setPage(page.id, (p) => ({ ...p, rows: [...p.rows, blankRow()] }));
  const removeRow = (rowId: string) => page && setPage(page.id, (p) => ({ ...p, rows: p.rows.filter((r) => r.id !== rowId) }));
  const setRowWidths = (rowId: string, widths: number[]) =>
    page &&
    setPage(page.id, (p) => ({
      ...p,
      rows: p.rows.map((r) => (r.id === rowId ? { ...r, columns: cols(widths, r.columns.map((c) => c.block)) } : r)),
    }));
  const setAreaBlock = (rowId: string, colId: string, block: ProposalColumn['block']) =>
    page &&
    setPage(page.id, (p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.id === rowId ? { ...r, columns: r.columns.map((c) => (c.id === colId ? { ...c, block } : c)) } : r,
      ),
    }));
  const setBlockProp = (rowId: string, colId: string, key: string, value: unknown) =>
    page &&
    setPage(page.id, (p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              columns: r.columns.map((c) =>
                c.id === colId && c.block ? { ...c, block: { ...c.block, props: { ...c.block.props, [key]: value } } } : c,
              ),
            }
          : r,
      ),
    }));

  const onDragEnd = (e: DragEndEvent) => {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : '';
    if (!o) return;
    // Place a palette block into an area
    if (a.startsWith('palette:') && o.startsWith('area:')) {
      const type = a.slice('palette:'.length) as ProposalBlockType;
      const [, rowId, colId] = o.split(':');
      setAreaBlock(rowId, colId, { type, props: {} });
      return;
    }
    // Move a placed block to another area (swap)
    if (a.startsWith('block:') && o.startsWith('area:')) {
      const [, fromRow, fromCol] = a.split(':');
      const [, toRow, toCol] = o.split(':');
      if (fromRow === toRow && fromCol === toCol) return;
      const src = page?.rows.find((r) => r.id === fromRow)?.columns.find((c) => c.id === fromCol)?.block ?? null;
      const dst = page?.rows.find((r) => r.id === toRow)?.columns.find((c) => c.id === toCol)?.block ?? null;
      setAreaBlock(toRow, toCol, src);
      setAreaBlock(fromRow, fromCol, dst);
      return;
    }
    // Reorder rows within the page
    if (a.startsWith('row:') && o.startsWith('row:') && page) {
      const ids = page.rows.map((r) => `row:${r.id}`);
      const from = ids.indexOf(a);
      const to = ids.indexOf(o);
      if (from >= 0 && to >= 0) setPage(page.id, (p) => ({ ...p, rows: arrayMove(p.rows, from, to) }));
    }
  };

  const save = () =>
    update.mutate(
      { id: template.id, body: { name: name.trim(), theme, layout: pages } },
      { onSuccess: () => notifications.show({ message: 'Template saved', color: 'green' }), onError: fail },
    );

  const selBlock =
    sel && page ? page.rows.find((r) => r.id === sel.rowId)?.columns.find((c) => c.id === sel.colId)?.block ?? null : null;

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/settings/proposals" c="dimmed" size="sm">
        <Group gap={4} wrap="nowrap">
          <IconArrowLeft size={14} /> Proposal templates
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput label="Template name" value={name} onChange={(e) => setName(e.currentTarget.value)} style={{ flex: '1 1 260px' }} />
        <Group gap="xs">
          <Button variant="default" leftSection={<IconEye size={16} />} onClick={previewCtl.open}>
            Preview
          </Button>
          <Button variant="default" leftSection={<IconPalette size={16} />} onClick={themeCtl.open}>
            Theme
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={update.isPending}>
            Save
          </Button>
        </Group>
      </Group>

      {/* Pages strip */}
      <Group gap="xs" wrap="wrap">
        {pages.map((p, i) => (
          <Button
            key={p.id}
            size="xs"
            variant={p.id === pageId ? 'filled' : 'default'}
            rightSection={
              pages.length > 1 ? (
                <IconX
                  size={12}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    removePage(p.id);
                  }}
                />
              ) : null
            }
            onClick={() => {
              setPageId(p.id);
              setSel(null);
            }}
          >
            Page {i + 1}
          </Button>
        ))}
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addPage}>
          Page
        </Button>
      </Group>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <Group align="flex-start" gap="lg" wrap="wrap">
          {/* Canvas */}
          <Stack gap="sm" style={{ flex: '1 1 520px', minWidth: 320 }}>
            {page && (
              <SortableContext items={page.rows.map((r) => `row:${r.id}`)} strategy={verticalListSortingStrategy}>
                {page.rows.map((row) => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    selected={sel}
                    onSelect={(colId) => setSel({ rowId: row.id, colId })}
                    onWidths={(w) => setRowWidths(row.id, w)}
                    onRemove={() => removeRow(row.id)}
                    onClearBlock={(colId) => setAreaBlock(row.id, colId, null)}
                    blockLabel={(t) => meta?.blocks.find((b) => b.type === t)?.label ?? t}
                  />
                ))}
              </SortableContext>
            )}
            <Button variant="light" onClick={addRow}>
              + Add section
            </Button>
          </Stack>

          {/* Sidebar: palette + block settings */}
          <Stack gap="md" style={{ flex: '0 0 260px', minWidth: 240 }}>
            <Card withBorder radius="md" padding="sm">
              <Text size="sm" fw={600} mb="xs">
                Blocks — drag onto a section
              </Text>
              <Stack gap={6}>
                {(meta?.blocks ?? []).map((b) => (
                  <PaletteChip key={b.type} type={b.type} label={b.label} />
                ))}
              </Stack>
            </Card>

            {selBlock && sel && (
              <Card withBorder radius="md" padding="sm">
                <Text size="sm" fw={600} mb="xs">
                  {meta?.blocks.find((b) => b.type === selBlock.type)?.label ?? selBlock.type} settings
                </Text>
                <BlockSettings type={selBlock.type} props={selBlock.props} onChange={(k, v) => setBlockProp(sel.rowId, sel.colId, k, v)} />
              </Card>
            )}
          </Stack>
        </Group>
      </DndContext>

      <ThemeModal opened={themeOpen} onClose={themeCtl.close} theme={theme} fonts={meta?.fonts ?? []} onChange={setTheme} />
      <Modal opened={previewOpen} onClose={previewCtl.close} title="Preview (example data)" size="xl" centered>
        <Paper p="lg" radius="md" bg="var(--mantine-color-gray-1)">
          <ProposalRenderer layout={pages} theme={theme} paged ctx={buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example])))} />
        </Paper>
      </Modal>
    </Stack>
  );
}

function RowEditor({
  row,
  selected,
  onSelect,
  onWidths,
  onRemove,
  onClearBlock,
  blockLabel,
}: {
  row: ProposalPage['rows'][number];
  selected: { rowId: string; colId: string } | null;
  onSelect: (colId: string) => void;
  onWidths: (widths: number[]) => void;
  onRemove: () => void;
  onClearBlock: (colId: string) => void;
  blockLabel: (t: ProposalBlockType) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `row:${row.id}` });
  const preset = ROW_PRESETS.find((p) => p.widths.join('-') === row.columns.map((c) => c.width).join('-'))?.value ?? '12';
  return (
    <Card
      ref={setNodeRef}
      withBorder
      radius="md"
      padding="sm"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap={6}>
          <ActionIcon variant="subtle" color="gray" {...attributes} {...listeners} aria-label="Drag section" style={{ cursor: 'grab' }}>
            <IconGripVertical size={16} />
          </ActionIcon>
          <Select
            size="xs"
            w={190}
            data={ROW_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            value={preset}
            onChange={(v) => onWidths(ROW_PRESETS.find((p) => p.value === v)?.widths ?? [12])}
            allowDeselect={false}
          />
        </Group>
        <ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Remove section">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      <Group align="stretch" gap="xs" wrap="nowrap">
        {row.columns.map((c) => (
          <Area
            key={c.id}
            rowId={row.id}
            col={c}
            selected={selected?.rowId === row.id && selected?.colId === c.id}
            onSelect={() => onSelect(c.id)}
            onClear={() => onClearBlock(c.id)}
            label={c.block ? blockLabel(c.block.type) : ''}
          />
        ))}
      </Group>
    </Card>
  );
}

function Area({
  rowId,
  col,
  selected,
  onSelect,
  onClear,
  label,
}: {
  rowId: string;
  col: ProposalColumn;
  selected: boolean;
  onSelect: () => void;
  onClear: () => void;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `area:${rowId}:${col.id}` });
  const drag = useDraggable({ id: `block:${rowId}:${col.id}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      style={{
        flex: col.width,
        minWidth: 0,
        minHeight: 54,
        borderRadius: 8,
        border: `1px dashed ${isOver ? 'var(--mantine-color-candango-6)' : selected ? 'var(--mantine-color-candango-4)' : 'var(--mantine-color-gray-4)'}`,
        background: isOver ? 'var(--mantine-color-candango-0)' : selected ? 'var(--mantine-color-candango-0)' : 'transparent',
        padding: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {col.block ? (
        <Group gap={4} wrap="nowrap" ref={drag.setNodeRef} {...drag.attributes} style={{ transform: CSS.Translate.toString(drag.transform) }}>
          <Badge variant="light" color="candango" style={{ textTransform: 'none', cursor: 'grab' }} {...drag.listeners}>
            {label}
          </Badge>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Remove block"
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
      ) : (
        <Text size="xs" c="dimmed">
          Drop a block
        </Text>
      )}
    </div>
  );
}

function PaletteChip({ type, label }: { type: ProposalBlockType; label: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `palette:${type}` });
  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="sm"
      p="xs"
      {...attributes}
      {...listeners}
      style={{ cursor: 'grab', transform: CSS.Translate.toString(transform), background: 'var(--mantine-color-gray-0)' }}
    >
      <Text size="sm">{label}</Text>
    </Paper>
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
        <TextInput size="xs" placeholder="Title ({{variables}})" value={(props.title as string) ?? ''} onChange={(e) => onChange('title', e.currentTarget.value)} />
        <TextInput size="xs" placeholder="Subtitle" value={(props.subtitle as string) ?? ''} onChange={(e) => onChange('subtitle', e.currentTarget.value)} />
      </Stack>
    );
  }
  if (type === 'text') {
    return <Textarea size="xs" autosize minRows={3} maxRows={10} placeholder="Text (HTML + {{variables}})" value={(props.html as string) ?? ''} onChange={(e) => onChange('html', e.currentTarget.value)} />;
  }
  if (type === 'image') {
    return <TextInput size="xs" label="Image field key" description="Optional — which image custom field to pull; blank = choose per proposal." value={(props.fieldKey as string) ?? ''} onChange={(e) => onChange('fieldKey', e.currentTarget.value)} />;
  }
  if (type === 'document') {
    return <TextInput size="xs" label="Document field key" description="Optional — which document custom field to attach." value={(props.fieldKey as string) ?? ''} onChange={(e) => onChange('fieldKey', e.currentTarget.value)} />;
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
