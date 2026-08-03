'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  ColorInput,
  Group,
  Menu,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconClipboard, IconClipboardCopy, IconCheck, IconCopy, IconEye, IconLayout2, IconLayoutGrid, IconLock, IconPalette, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { CanvasElement, CanvasPage, ElementType, Orientation, ProposalDocFile, ProposalImageFile, ProposalTheme } from '@/lib/api/proposals';
import { RichTextBody } from '@/components/common/RichTextBody';
import { ElementView, ProposalRenderer, type MediaPick, type ProposalRenderCtx } from './ProposalRenderer';

// 12-column grid + a fine vertical unit, for the alignment overlay and snapping.
const COL = 100 / 12; // ≈ 8.333%
const ROW = 2.5;
const snapTo = (v: number, unit: number) => Math.round(v / unit) * unit;
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type FieldOption = { value: string; label: string };
export type EditorVariable = { key: string; label: string; group?: string };

/** Group variables by their `group` (preserving first-seen order) for the insert menu. */
function groupVars(variables: EditorVariable[]): [string, EditorVariable[]][] {
  const order: string[] = [];
  const map = new Map<string, EditorVariable[]>();
  for (const v of variables) {
    const g = v.group ?? 'Variables';
    if (!map.has(g)) {
      map.set(g, []);
      order.push(g);
    }
    map.get(g)!.push(v);
  }
  return order.map((g) => [g, map.get(g)!]);
}

const PALETTE: { type: ElementType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'document', label: 'Document' },
  { type: 'logo', label: 'Logo' },
  { type: 'pricing', label: 'Pricing' },
  { type: 'divider', label: 'Divider' },
];

type LegacyCol = { width?: number; block?: { type: string; props?: Record<string, unknown> } | null };
type LegacyPage = { id?: string; elements?: unknown; rows?: { columns?: LegacyCol[] }[] };

/** Convert any pre-canvas (flow rows/columns) pages to absolute elements so old templates still open. */
export function toCanvasPages(layout: unknown): CanvasPage[] {
  const arr = Array.isArray(layout) ? (layout as LegacyPage[]) : [];
  return arr.map((pg) => {
    if (Array.isArray(pg.elements)) return pg as unknown as CanvasPage;
    const elements: CanvasElement[] = [];
    let y = 4;
    for (const row of pg.rows ?? []) {
      let x = 4;
      const h = 12;
      for (const c of row.columns ?? []) {
        const w = ((c.width ?? 12) / 12) * 92;
        if (c.block) {
          const t = (c.block.type === 'cover' ? 'heading' : c.block.type) as ElementType;
          const props = c.block.type === 'cover' ? { text: (c.block.props?.title as string) ?? '' } : c.block.props ?? {};
          elements.push({ id: uid(), type: t, x, y, w, h, props });
        }
        x += w + 2;
      }
      y += h + 3;
    }
    return { id: pg.id ?? uid(), elements };
  });
}

/** A sensible default element (percent geometry) for a newly-added type. */
function newElement(type: ElementType): CanvasElement {
  const base = { id: uid(), x: 8, y: 8, w: 50, h: 12, props: {}, type } as CanvasElement;
  switch (type) {
    case 'heading':
      return { ...base, w: 70, h: 9, props: { text: 'Heading' }, style: { fontSize: 32, fontWeight: 800 } };
    case 'text':
      return { ...base, w: 60, h: 14, props: { html: '<p>Add your text…</p>' }, style: { fontSize: 15 } };
    case 'image':
      return { ...base, w: 45, h: 26, props: { label: 'Photos', cols: 1, count: 1 } };
    case 'document':
      return { ...base, w: 45, h: 8, props: { label: 'Document' } };
    case 'logo':
      return { ...base, w: 30, h: 10, props: { fit: 'contain' } };
    case 'pricing':
      return { ...base, w: 84, h: 22, props: {} };
    case 'divider':
      return { ...base, w: 84, h: 1, props: {}, style: { color: '#dee2e6' } };
    default:
      return base;
  }
}

const heading = (x: number, y: number, w: number, h: number, text: string): CanvasElement => ({ id: uid(), type: 'heading', x, y, w, h, props: { text }, style: { fontSize: 28, fontWeight: 800 } });
const textEl = (x: number, y: number, w: number, h: number, html: string): CanvasElement => ({ id: uid(), type: 'text', x, y, w, h, props: { html }, style: { fontSize: 15 } });
const imageEl = (x: number, y: number, w: number, h: number, label: string): CanvasElement => ({ id: uid(), type: 'image', x, y, w, h, props: { label, cols: 1, count: 1 } });

/** Page-level layout presets — apply a common structure to the current page. */
const PAGE_PRESETS: { key: string; label: string; build: () => CanvasElement[] }[] = [
  { key: 'blank', label: 'Blank', build: () => [] },
  { key: 'title', label: 'Title + content', build: () => [heading(6, 6, 88, 9, 'Heading'), textEl(6, 18, 88, 66, '<p>Content…</p>')] },
  { key: '2col', label: 'Two columns', build: () => [heading(6, 6, 88, 8, 'Heading'), textEl(6, 16, 42, 66, '<p>Left column…</p>'), textEl(52, 16, 42, 66, '<p>Right column…</p>')] },
  { key: '3col', label: 'Three columns', build: () => [textEl(6, 8, 27, 74, '<p>One…</p>'), textEl(37, 8, 27, 74, '<p>Two…</p>'), textEl(68, 8, 27, 74, '<p>Three…</p>')] },
  { key: 'gallery', label: 'Cover + gallery', build: () => [heading(6, 6, 88, 10, '{{deal.title}}'), imageEl(6, 20, 88, 30, 'Gallery')] },
  { key: 'hero', label: 'Hero + pricing', build: () => [heading(6, 8, 88, 12, '{{deal.title}}'), textEl(6, 24, 88, 20, '<p>Overview…</p>'), { id: uid(), type: 'pricing', x: 6, y: 50, w: 88, h: 30, props: {} }] },
];

export interface ProposalCanvasEditorProps {
  pages: CanvasPage[];
  onPagesChange: (pages: CanvasPage[]) => void;
  theme: ProposalTheme;
  onThemeChange: (theme: ProposalTheme) => void;
  variables: EditorVariable[];
  fonts: string[];
  ctx: ProposalRenderCtx;
  imageFields?: FieldOption[];
  documentFields?: FieldOption[];
  /** The deal's actual files (deal builder only), for the per-proposal image/document picker. */
  imageFilesByField?: Record<string, ProposalImageFile[]>;
  documentFilesByField?: Record<string, ProposalDocFile[]>;
  /** When true (deal builder), elements the template marked as locked can't be moved/edited/deleted. */
  enforceLocks?: boolean;
}

export function ProposalCanvasEditor({
  pages,
  onPagesChange,
  theme,
  onThemeChange,
  variables,
  fonts,
  ctx,
  imageFields = [],
  documentFields = [],
  imageFilesByField = {},
  documentFilesByField = {},
  enforceLocks = false,
}: ProposalCanvasEditorProps) {
  const [pageId, setPageId] = useState<string | null>(pages[0]?.id ?? null);
  const [selId, setSelId] = useState<string | null>(null);
  const [themeOpen, themeCtl] = useDisclosure(false);
  const [previewOpen, previewCtl] = useDisclosure(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMargins, setShowMargins] = useState(false);
  const [snap, setSnap] = useState(true);
  const [clipboard, setClipboard] = useState<CanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const margin = theme.margin ?? 6;

  const activeId = pageId && pages.some((p) => p.id === pageId) ? pageId : pages[0]?.id ?? null;
  const page = useMemo(() => pages.find((p) => p.id === activeId) ?? null, [pages, activeId]);
  const sel = page?.elements.find((e) => e.id === selId) ?? null;

  const setPageElements = (fn: (els: CanvasElement[]) => CanvasElement[]) =>
    page && onPagesChange(pages.map((p) => (p.id === page.id ? { ...p, elements: fn(p.elements) } : p)));
  const addElement = (type: ElementType) => {
    const el = newElement(type);
    setPageElements((els) => [...els, el]);
    setSelId(el.id);
  };
  /** Place a dragged-in element where it was dropped (percent geometry, snapped + clamped). */
  const addElementAt = (type: ElementType, xPct: number, yPct: number) => {
    const el = newElement(type);
    el.x = clamp(snap ? snapTo(xPct, COL) : xPct, 0, 100 - el.w);
    el.y = clamp(snap ? snapTo(yPct, ROW) : yPct, 0, 100 - el.h);
    setPageElements((els) => [...els, el]);
    setSelId(el.id);
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/proposal-element') as ElementType;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!type || !rect) return;
    addElementAt(type, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
  };
  const applyPreset = (build: () => CanvasElement[]) => {
    if ((page?.elements.length ?? 0) > 0 && !window.confirm('Replace this page with the chosen layout?')) return;
    setPageElements(() => build());
    setSelId(null);
  };
  const updateElement = (elId: string, patch: Partial<CanvasElement>) =>
    setPageElements((els) => els.map((e) => (e.id === elId ? { ...e, ...patch } : e)));
  const setStyle = (elId: string, patch: Partial<NonNullable<CanvasElement['style']>>) =>
    setPageElements((els) => els.map((e) => (e.id === elId ? { ...e, style: { ...e.style, ...patch } } : e)));
  const setProp = (elId: string, key: string, value: unknown) =>
    setPageElements((els) => els.map((e) => (e.id === elId ? { ...e, props: { ...e.props, [key]: value } } : e)));
  const removeElement = (elId: string) => {
    setPageElements((els) => els.filter((e) => e.id !== elId));
    if (selId === elId) setSelId(null);
  };
  const cloneEl = (el: CanvasElement, dx = 3, dy = 3): CanvasElement => ({
    ...el,
    id: uid(),
    x: clamp(el.x + dx, 0, 100 - el.w),
    y: clamp(el.y + dy, 0, 100 - el.h),
    props: { ...el.props },
    style: { ...el.style },
  });
  const duplicateElement = (elId: string) => {
    const el = page?.elements.find((e) => e.id === elId);
    if (!el) return;
    const copy = cloneEl(el);
    setPageElements((els) => [...els, copy]);
    setSelId(copy.id);
  };
  /** Paste the clipboard element onto the CURRENT page (enables cross-page copy/paste). */
  const pasteElement = () => {
    if (!clipboard) return;
    const copy = cloneEl(clipboard);
    setPageElements((els) => [...els, copy]);
    setSelId(copy.id);
  };

  const addPage = () => {
    const np = { id: uid(), elements: [] };
    onPagesChange([...pages, np]);
    setPageId(np.id);
    setSelId(null);
  };
  const duplicatePage = (pid: string) => {
    const src = pages.find((p) => p.id === pid);
    if (!src) return;
    const copy: CanvasPage = { id: uid(), elements: src.elements.map((e) => ({ ...e, id: uid(), props: { ...e.props }, style: { ...e.style } })) };
    const idx = pages.findIndex((p) => p.id === pid);
    onPagesChange([...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)]);
    setPageId(copy.id);
    setSelId(null);
  };
  const removePage = (pid: string) => {
    const next = pages.filter((p) => p.id !== pid);
    const safe = next.length ? next : [{ id: uid(), elements: [] }];
    onPagesChange(safe);
    if (pid === activeId) setPageId(safe[0].id);
  };

  const insertVar = (key: string) => {
    if (!sel) return;
    if (sel.type === 'heading') setProp(sel.id, 'text', `${(sel.props.text as string) ?? ''}{{${key}}}`);
    else if (sel.type === 'text') setProp(sel.id, 'html', `${(sel.props.html as string) ?? ''}{{${key}}}`);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="lg">
          <SegmentedControl
            size="xs"
            data={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            value={theme.orientation ?? 'portrait'}
            onChange={(v) => onThemeChange({ ...theme, orientation: v as Orientation })}
          />
          <Switch size="xs" label="12-col grid" checked={showGrid} onChange={(e) => setShowGrid(e.currentTarget.checked)} thumbIcon={<IconLayoutGrid size={10} />} />
          <Switch size="xs" label="Snap to grid" checked={snap} onChange={(e) => setSnap(e.currentTarget.checked)} />
          <Switch size="xs" label="Margins" checked={showMargins} onChange={(e) => setShowMargins(e.currentTarget.checked)} />
        </Group>
        <Group gap="xs">
          <Menu position="bottom-end" withinPortal shadow="sm">
            <Menu.Target>
              <Button variant="default" size="xs" leftSection={<IconLayout2 size={16} />}>
                Layout
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Apply a page layout</Menu.Label>
              {PAGE_PRESETS.map((p) => (
                <Menu.Item key={p.key} onClick={() => applyPreset(p.build)}>
                  {p.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          {clipboard && (
            <Button variant="light" size="xs" leftSection={<IconClipboard size={16} />} onClick={pasteElement}>
              Paste
            </Button>
          )}
          <Button variant="default" size="xs" leftSection={<IconEye size={16} />} onClick={previewCtl.open}>
            Preview
          </Button>
          <Button variant="default" size="xs" leftSection={<IconPalette size={16} />} onClick={themeCtl.open}>
            Theme
          </Button>
        </Group>
      </Group>

      {/* Pages strip */}
      <Group gap="xs" wrap="wrap">
        {pages.map((p, i) => (
          <Button
            key={p.id}
            size="xs"
            variant={p.id === activeId ? 'filled' : 'default'}
            rightSection={
              <Group gap={4} wrap="nowrap">
                <IconCopy size={12} title="Duplicate page" onClick={(ev) => { ev.stopPropagation(); duplicatePage(p.id); }} />
                {pages.length > 1 && <IconX size={12} title="Delete page" onClick={(ev) => { ev.stopPropagation(); removePage(p.id); }} />}
              </Group>
            }
            onClick={() => { setPageId(p.id); setSelId(null); }}
          >
            Page {i + 1}
          </Button>
        ))}
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addPage}>
          Page
        </Button>
      </Group>

      <Group align="flex-start" gap="lg" wrap="wrap">
        {/* Canvas */}
        <div style={{ flex: '1 1 560px', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: theme.orientation === 'landscape' ? 860 : 640 }}>
            <div
              ref={pageRef}
              onPointerDown={() => setSelId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onCanvasDrop}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: theme.orientation === 'landscape' ? '11 / 8.5' : '8.5 / 11',
                background: '#fff',
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* 12-column reference grid */}
              {showGrid && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i + 1) * COL}%`, width: 1, background: 'rgba(0,0,0,0.06)' }} />
                  ))}
                </div>
              )}
              {/* Safe-area margin guide */}
              {showMargins && (
                <div
                  style={{
                    position: 'absolute',
                    inset: `${margin}% ${margin}%`,
                    border: '1px dashed rgba(217,85,44,0.5)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {page?.elements.map((el) => (
                <EditableElement
                  key={el.id}
                  el={el}
                  selected={el.id === selId}
                  locked={enforceLocks && !!el.props.locked}
                  theme={theme}
                  ctx={ctx}
                  pageRef={pageRef}
                  snap={snap}
                  onSelect={() => setSelId(el.id)}
                  onChange={(patch) => updateElement(el.id, patch)}
                  onRemove={() => removeElement(el.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <Stack gap="md" style={{ flex: '0 0 280px', minWidth: 250 }}>
          <Card withBorder radius="md" padding="sm">
            <Text size="sm" fw={600} mb={2}>
              Add element
            </Text>
            <Text size="xs" c="dimmed" mb="xs">
              Drag onto the page, or click to drop it in.
            </Text>
            <Group gap={6}>
              {PALETTE.map((b) => (
                <Button
                  key={b.type}
                  size="xs"
                  variant="default"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/proposal-element', b.type)}
                  onClick={() => addElement(b.type)}
                  style={{ cursor: 'grab' }}
                >
                  {b.label}
                </Button>
              ))}
            </Group>
          </Card>

          {sel ? (
            <Card withBorder radius="md" padding="sm">
              <Group justify="space-between" mb="xs">
                <Group gap={6} wrap="nowrap">
                  {enforceLocks && !!sel.props.locked && <IconLock size={13} />}
                  <Text size="sm" fw={600}>
                    {(sel.props.label as string) || PALETTE.find((p) => p.type === sel.type)?.label || sel.type}
                  </Text>
                </Group>
                {!(enforceLocks && sel.props.locked) && (
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon variant="subtle" color="gray" onClick={() => duplicateElement(sel.id)} aria-label="Duplicate element" title="Duplicate">
                      <IconCopy size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="gray" onClick={() => setClipboard(sel)} aria-label="Copy element" title="Copy (paste on any page)">
                      <IconClipboardCopy size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => removeElement(sel.id)} aria-label="Delete element">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                )}
              </Group>
              <ElementSettings
                el={sel}
                fonts={fonts}
                showLock={!enforceLocks}
                locked={enforceLocks && !!sel.props.locked}
                onProp={(k, v) => setProp(sel.id, k, v)}
                onStyle={(patch) => setStyle(sel.id, patch)}
                onGeom={(patch) => updateElement(sel.id, patch)}
                variables={variables}
                onInsertVar={insertVar}
                imageFields={imageFields}
                documentFields={documentFields}
                imageFilesByField={imageFilesByField}
                documentFilesByField={documentFilesByField}
              />
            </Card>
          ) : (
            <Text size="xs" c="dimmed">
              Add or select an element to edit it. Drag to move; drag the corner to resize.
            </Text>
          )}
        </Stack>
      </Group>

      <ThemeModal opened={themeOpen} onClose={themeCtl.close} theme={theme} fonts={fonts} onChange={onThemeChange} />
      <Modal opened={previewOpen} onClose={previewCtl.close} title="Preview" size="xl" centered>
        <Paper p="lg" radius="md" bg="var(--mantine-color-gray-1)">
          <ProposalRenderer layout={pages} theme={theme} paged ctx={ctx} />
        </Paper>
      </Modal>
    </Stack>
  );
}

// ── Draggable / resizable element on the canvas ────────────────────────────────
function EditableElement({
  el,
  selected,
  locked,
  theme,
  ctx,
  pageRef,
  snap,
  onSelect,
  onChange,
  onRemove,
}: {
  el: CanvasElement;
  selected: boolean;
  locked: boolean;
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  pageRef: React.RefObject<HTMLDivElement | null>;
  snap: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
  onRemove: () => void;
}) {
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ex: number; ey: number; ew: number; eh: number } | null>(null);
  const label = el.props.label as string | undefined;
  const showTag = (el.type === 'image' || el.type === 'document') && !!label;

  const selectableWhenLocked = el.type === 'image' || el.type === 'document';
  const start = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (locked) {
      // A locked media element can still be selected so the salesperson picks its files.
      if (selectableWhenLocked) {
        e.stopPropagation();
        onSelect();
      }
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ex: el.x, ey: el.y, ew: el.w, eh: el.h };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dxp = ((e.clientX - d.sx) / rect.width) * 100;
    const dyp = ((e.clientY - d.sy) / rect.height) * 100;
    const sx = (v: number) => (snap ? snapTo(v, COL) : v);
    const sy = (v: number) => (snap ? snapTo(v, ROW) : v);
    if (d.mode === 'move') {
      onChange({ x: clamp(sx(d.ex + dxp), 0, 100 - el.w), y: clamp(sy(d.ey + dyp), 0, 100 - el.h) });
    } else {
      onChange({ w: clamp(sx(d.ew + dxp), 5, 100 - el.x), h: clamp(sy(d.eh + dyp), 2, 100 - el.y) });
    }
  };
  const onUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  return (
    <div
      onPointerDown={start('move')}
      style={{
        position: 'absolute',
        left: `${el.x}%`,
        top: `${el.y}%`,
        width: `${el.w}%`,
        height: `${el.h}%`,
        outline: selected ? `2px solid ${theme.primaryColor}` : '1px dashed transparent',
        outlineOffset: 1,
        cursor: locked ? 'not-allowed' : 'move',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { if (!selected && !locked) e.currentTarget.style.outline = '1px dashed var(--mantine-color-gray-4)'; }}
      onMouseLeave={(e) => { if (!selected && !locked) e.currentTarget.style.outline = '1px dashed transparent'; }}
    >
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <ElementView element={el} theme={theme} ctx={ctx} />
      </div>
      {locked && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            display: 'inline-flex',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            padding: 2,
            borderRadius: 4,
            pointerEvents: 'none',
          }}
          title="Locked by the template"
        >
          <IconLock size={11} />
        </span>
      )}
      {showTag && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 10,
            lineHeight: 1.4,
            padding: '1px 6px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          {label}
        </span>
      )}
      {selected && !locked && (
        <>
          <ActionIcon
            size="xs"
            color="red"
            variant="filled"
            style={{ position: 'absolute', top: -10, right: -10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            aria-label="Delete"
          >
            <IconX size={12} />
          </ActionIcon>
          {/* resize handle (bottom-right) */}
          <div
            onPointerDown={start('resize')}
            style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, background: theme.primaryColor, borderRadius: 3, cursor: 'nwse-resize' }}
          />
        </>
      )}
    </div>
  );
}

function ElementSettings({
  el,
  fonts,
  showLock,
  locked,
  onProp,
  onStyle,
  onGeom,
  variables,
  onInsertVar,
  imageFields,
  documentFields,
  imageFilesByField,
  documentFilesByField,
}: {
  el: CanvasElement;
  fonts: string[];
  showLock: boolean;
  locked: boolean;
  onProp: (key: string, value: unknown) => void;
  onStyle: (patch: Partial<NonNullable<CanvasElement['style']>>) => void;
  onGeom: (patch: Partial<CanvasElement>) => void;
  variables: EditorVariable[];
  onInsertVar: (key: string) => void;
  imageFields: FieldOption[];
  documentFields: FieldOption[];
  imageFilesByField: Record<string, ProposalImageFile[]>;
  documentFilesByField: Record<string, ProposalDocFile[]>;
}) {
  const s = el.style ?? {};
  const textLike = el.type === 'text' || el.type === 'heading';
  const isMedia = el.type === 'image' || el.type === 'document';
  const pick = (el.props.pick as MediaPick) ?? 'recent';
  const media = isMedia ? (
    <MediaPicker el={el} onProp={onProp} imageFilesByField={imageFilesByField} documentFilesByField={documentFilesByField} />
  ) : null;

  // Locked media element: only its file selection is editable — everything else stays as the template set it.
  if (locked) {
    return (
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Locked by the template — you can still choose its {el.type === 'image' ? 'photos' : 'documents'}.
        </Text>
        {media}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {showLock && (
        <Switch
          size="xs"
          label="Lock in proposals"
          description="Salespeople can't move, edit or delete it — but can still pick its files."
          checked={!!el.props.locked}
          onChange={(e) => onProp('locked', e.currentTarget.checked)}
        />
      )}
      {/* Content */}
      {el.type === 'heading' && (
        <TextInput size="xs" label="Text" value={(el.props.text as string) ?? ''} onChange={(e) => onProp('text', e.currentTarget.value)} />
      )}
      {el.type === 'text' && (
        <div>
          <Text size="xs" fw={500} mb={4}>
            Text
          </Text>
          <RichTextBody value={(el.props.html as string) ?? ''} onChange={(html) => onProp('html', html)} minHeight={120} variables={variables} />
        </div>
      )}
      {isMedia && (
        <>
          <TextInput size="xs" label="Label" description="Only shown here, to help you edit." value={(el.props.label as string) ?? ''} onChange={(e) => onProp('label', e.currentTarget.value)} />
          <FieldPicker
            type={el.type as 'image' | 'document'}
            value={(el.props.fieldKey as string) ?? ''}
            onChange={(v) => onProp('fieldKey', v)}
            options={el.type === 'image' ? imageFields : documentFields}
          />
        </>
      )}
      {el.type === 'image' && (
        <Group gap="xs" grow>
          {pick !== 'manual' && (
            <NumberInput size="xs" label="Photos" min={1} max={12} value={(el.props.count as number) ?? 1} onChange={(v) => onProp('count', Math.max(1, Number(v) || 1))} />
          )}
          <NumberInput size="xs" label="Columns" min={1} max={4} value={(el.props.cols as number) ?? 1} onChange={(v) => onProp('cols', Math.max(1, Number(v) || 1))} />
        </Group>
      )}
      {media}
      {el.type === 'logo' && (
        <div>
          <Text size="xs" fw={500} mb={2}>
            Fit
          </Text>
          <SegmentedControl
            size="xs"
            fullWidth
            data={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }]}
            value={(el.props.fit as string) ?? 'contain'}
            onChange={(v) => onProp('fit', v)}
          />
          <Text size="xs" c="dimmed" mt={4}>
            Uses your workspace logo (Settings → Workspace).
          </Text>
        </div>
      )}
      {el.type === 'pricing' && (
        <Text size="xs" c="dimmed">
          Fills from the estimate(s) selected on the proposal.
        </Text>
      )}

      {textLike && (
        <>
          <Group gap="xs" grow>
            <NumberInput size="xs" label="Font size" min={8} max={96} value={s.fontSize ?? (el.type === 'heading' ? 32 : 15)} onChange={(v) => onStyle({ fontSize: Number(v) || undefined })} />
            <Select size="xs" label="Weight" data={['400', '600', '700', '800']} value={String(s.fontWeight ?? (el.type === 'heading' ? 800 : 400))} onChange={(v) => onStyle({ fontWeight: Number(v) })} allowDeselect={false} />
          </Group>
          <Group gap="xs" grow>
            <ColorInput size="xs" label="Color" value={s.color ?? ''} onChange={(v) => onStyle({ color: v || undefined })} />
            <div>
              <Text size="xs" fw={500} mb={2}>
                Align
              </Text>
              <SegmentedControl size="xs" fullWidth data={[{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }]} value={s.align ?? 'left'} onChange={(v) => onStyle({ align: v as 'left' | 'center' | 'right' })} />
            </div>
          </Group>
          {variables.length > 0 && (
            <Menu position="bottom-start" withinPortal shadow="sm" width={220}>
              <Menu.Target>
                <Button size="xs" variant="light" leftSection={<IconPlus size={12} />}>
                  Insert variable
                </Button>
              </Menu.Target>
              <Menu.Dropdown mah={320} style={{ overflowY: 'auto' }}>
                {groupVars(variables).map(([group, vs]) => (
                  <div key={group}>
                    <Menu.Label>{group}</Menu.Label>
                    {vs.map((v) => (
                      <Menu.Item key={v.key} onClick={() => onInsertVar(v.key)}>
                        {v.label}
                      </Menu.Item>
                    ))}
                  </div>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </>
      )}

      <ColorInput size="xs" label="Background" value={s.background ?? ''} onChange={(v) => onStyle({ background: v || undefined })} />
      <Group gap="xs" grow>
        <NumberInput size="xs" label="X %" min={0} max={100} value={Math.round(el.x)} onChange={(v) => onGeom({ x: Number(v) || 0 })} />
        <NumberInput size="xs" label="Y %" min={0} max={100} value={Math.round(el.y)} onChange={(v) => onGeom({ y: Number(v) || 0 })} />
        <NumberInput size="xs" label="W %" min={5} max={100} value={Math.round(el.w)} onChange={(v) => onGeom({ w: Number(v) || 5 })} />
        <NumberInput size="xs" label="H %" min={2} max={100} value={Math.round(el.h)} onChange={(v) => onGeom({ h: Number(v) || 2 })} />
      </Group>
    </Stack>
  );
}

/**
 * Choose which of a field's files fill an image/document element: newest-first, oldest-first, or a
 * manual selection (thumbnails/checkboxes). Available even when the element is locked by the template.
 */
function MediaPicker({
  el,
  onProp,
  imageFilesByField,
  documentFilesByField,
}: {
  el: CanvasElement;
  onProp: (key: string, value: unknown) => void;
  imageFilesByField: Record<string, ProposalImageFile[]>;
  documentFilesByField: Record<string, ProposalDocFile[]>;
}) {
  const isImage = el.type === 'image';
  const fk = (el.props.fieldKey as string) || '';
  const files: { key: string; url: string; name?: string }[] = isImage
    ? fk
      ? imageFilesByField[fk] ?? []
      : Object.values(imageFilesByField).flat()
    : fk
      ? documentFilesByField[fk] ?? []
      : Object.values(documentFilesByField).flat();
  const pick = (el.props.pick as MediaPick) ?? 'recent';
  const picked = (el.props.picked as string[]) ?? [];
  const noun = isImage ? 'photos' : 'documents';

  const toggle = (key: string) =>
    onProp('picked', picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]);

  return (
    <Stack gap={6}>
      <Select
        size="xs"
        label={isImage ? 'Which photos' : 'Which documents'}
        data={[
          { value: 'recent', label: 'Most recent' },
          { value: 'oldest', label: 'Oldest' },
          { value: 'manual', label: 'Choose specific' },
        ]}
        value={pick}
        onChange={(v) => onProp('pick', (v as MediaPick) ?? 'recent')}
        allowDeselect={false}
      />
      {pick === 'manual' &&
        (files.length === 0 ? (
          <Text size="xs" c="dimmed">
            No {noun} on this deal{fk ? ' for this field' : ''} yet.
          </Text>
        ) : isImage ? (
          <SimpleGrid cols={3} spacing={6}>
            {[...files].reverse().map((f) => {
              const on = picked.includes(f.key);
              return (
                <div
                  key={f.key}
                  onClick={() => toggle(f.key)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    aspectRatio: '1',
                    borderRadius: 6,
                    overflow: 'hidden',
                    outline: on ? '2px solid var(--mantine-color-candango-6)' : '1px solid var(--mantine-color-gray-3)',
                  }}
                >
                  <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 1 : 0.6 }} />
                  {on && (
                    <div style={{ position: 'absolute', top: 2, right: 2, background: 'var(--mantine-color-candango-6)', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={11} />
                    </div>
                  )}
                </div>
              );
            })}
          </SimpleGrid>
        ) : (
          <Stack gap={4}>
            {[...files].reverse().map((f) => (
              <Checkbox key={f.key} size="xs" label={f.name ?? 'Document'} checked={picked.includes(f.key)} onChange={() => toggle(f.key)} />
            ))}
          </Stack>
        ))}
      {pick === 'manual' && picked.length > 0 && (
        <Text size="xs" c="dimmed">
          {picked.length} selected · shown in the order you pick them.
        </Text>
      )}
    </Stack>
  );
}

/** Bind an image/document element to a custom field — a Select of the deal's fields, or a raw key when none are known. */
function FieldPicker({ type, value, onChange, options }: { type: 'image' | 'document'; value: string; onChange: (v: string) => void; options: FieldOption[] }) {
  const desc = `Which ${type} custom field fills this — blank uses all ${type}s on the deal.`;
  if (options.length === 0) {
    return <TextInput size="xs" label="Field key" description={desc} value={value} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
  return (
    <Select
      size="xs"
      label="Field"
      description={desc}
      placeholder={`All ${type}s`}
      clearable
      data={options}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
    />
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
        <ColorInput label="Accent (text) color" value={theme.accentColor} onChange={(v) => set({ accentColor: v })} />
        <Select label="Heading font" data={fonts} value={theme.fontHeading} onChange={(v) => set({ fontHeading: v ?? theme.fontHeading })} allowDeselect={false} />
        <Select label="Body font" data={fonts} value={theme.fontBody} onChange={(v) => set({ fontBody: v ?? theme.fontBody })} allowDeselect={false} />
        <NumberInput label="Margin guide (%)" description="Safe area shown when Margins is on." min={0} max={20} value={theme.margin ?? 6} onChange={(v) => set({ margin: Number(v) || 0 })} />
        <Button onClick={onClose}>Done</Button>
      </Stack>
    </Modal>
  );
}
