'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  NumberInput,
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
  IconDeviceFloppy,
  IconEye,
  IconPalette,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useProposalMeta, useProposalTemplate, useTemplateVariables, useUpdateProposalTemplate } from '@/lib/api/hooks';
import type { CanvasElement, CanvasPage, ElementType, Orientation, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, ProposalRenderer, type ProposalRenderCtx } from '@/components/proposals/ProposalRenderer';
import { buildPreviewCtx } from '@/components/proposals/previewCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const PALETTE: { type: ElementType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'document', label: 'Document' },
  { type: 'pricing', label: 'Pricing' },
  { type: 'divider', label: 'Divider' },
];

type LegacyCol = { width?: number; block?: { type: string; props?: Record<string, unknown> } | null };
type LegacyPage = { id?: string; elements?: unknown; rows?: { columns?: LegacyCol[] }[] };

/** Convert any pre-canvas (flow rows/columns) pages to absolute elements so old templates still open. */
function toCanvasPages(layout: unknown): CanvasPage[] {
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
      return { ...base, w: 45, h: 26, props: {} };
    case 'document':
      return { ...base, w: 45, h: 8, props: {} };
    case 'pricing':
      return { ...base, w: 84, h: 22, props: {} };
    case 'divider':
      return { ...base, w: 84, h: 1, props: {}, style: { color: '#dee2e6' } };
    default:
      return base;
  }
}

export default function ProposalTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useProposalTemplate(id);
  const { data: meta } = useProposalMeta();
  const { data: variables = [] } = useTemplateVariables();
  const update = useUpdateProposalTemplate();

  const [name, setName] = useState('');
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [pages, setPages] = useState<CanvasPage[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [themeOpen, themeCtl] = useDisclosure(false);
  const [previewOpen, previewCtl] = useDisclosure(false);
  const pageRef = useRef<HTMLDivElement>(null);

  const ctx: ProposalRenderCtx = useMemo(
    () => buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example]))),
    [variables],
  );

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setTheme({ orientation: 'portrait', ...template.theme });
    const p = toCanvasPages(template.layout);
    const init = p.length ? p : [{ id: uid(), elements: [] }];
    setPages(init);
    setPageId(init[0].id);
  }, [template]);

  const page = useMemo(() => pages.find((p) => p.id === pageId) ?? null, [pages, pageId]);
  const sel = page?.elements.find((e) => e.id === selId) ?? null;

  if (isLoading || !template || !theme) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  const setPageElements = (fn: (els: CanvasElement[]) => CanvasElement[]) =>
    page && setPages((ps) => ps.map((p) => (p.id === page.id ? { ...p, elements: fn(p.elements) } : p)));
  const addElement = (type: ElementType) => {
    const el = newElement(type);
    setPageElements((els) => [...els, el]);
    setSelId(el.id);
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

  const addPage = () => {
    const np = { id: uid(), elements: [] };
    setPages((ps) => [...ps, np]);
    setPageId(np.id);
    setSelId(null);
  };
  const removePage = (pid: string) =>
    setPages((ps) => {
      const next = ps.filter((p) => p.id !== pid);
      if (pid === pageId) setPageId(next[0]?.id ?? null);
      return next.length ? next : [{ id: uid(), elements: [] }];
    });

  const save = () =>
    update.mutate(
      { id: template.id, body: { name: name.trim(), theme, layout: pages } },
      { onSuccess: () => notifications.show({ message: 'Template saved', color: 'green' }), onError: fail },
    );

  const insertVar = (key: string) => {
    if (!sel) return;
    if (sel.type === 'heading') setProp(sel.id, 'text', `${(sel.props.text as string) ?? ''}{{${key}}}`);
    else if (sel.type === 'text') setProp(sel.id, 'html', `${(sel.props.html as string) ?? ''}{{${key}}}`);
  };

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/settings/proposals" c="dimmed" size="sm">
        <Group gap={4} wrap="nowrap">
          <IconArrowLeft size={14} /> Proposal templates
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput label="Template name" value={name} onChange={(e) => setName(e.currentTarget.value)} style={{ flex: '1 1 240px' }} />
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            data={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            value={theme.orientation ?? 'portrait'}
            onChange={(v) => setTheme({ ...theme, orientation: v as Orientation })}
          />
          <Button variant="default" size="sm" leftSection={<IconEye size={16} />} onClick={previewCtl.open}>
            Preview
          </Button>
          <Button variant="default" size="sm" leftSection={<IconPalette size={16} />} onClick={themeCtl.open}>
            Theme
          </Button>
          <Button size="sm" leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={update.isPending}>
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
            rightSection={pages.length > 1 ? <IconX size={12} onClick={(ev) => { ev.stopPropagation(); removePage(p.id); }} /> : null}
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
              {page?.elements.map((el) => (
                <EditableElement
                  key={el.id}
                  el={el}
                  selected={el.id === selId}
                  theme={theme}
                  ctx={ctx}
                  pageRef={pageRef}
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
            <Text size="sm" fw={600} mb="xs">
              Add element
            </Text>
            <Group gap={6}>
              {PALETTE.map((b) => (
                <Button key={b.type} size="xs" variant="default" onClick={() => addElement(b.type)}>
                  {b.label}
                </Button>
              ))}
            </Group>
          </Card>

          {sel ? (
            <Card withBorder radius="md" padding="sm">
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>
                  {PALETTE.find((p) => p.type === sel.type)?.label ?? sel.type}
                </Text>
                <ActionIcon variant="subtle" color="red" onClick={() => removeElement(sel.id)} aria-label="Delete element">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <ElementSettings
                el={sel}
                fonts={meta?.fonts ?? []}
                onProp={(k, v) => setProp(sel.id, k, v)}
                onStyle={(patch) => setStyle(sel.id, patch)}
                onGeom={(patch) => updateElement(sel.id, patch)}
                variables={variables}
                onInsertVar={insertVar}
              />
            </Card>
          ) : (
            <Text size="xs" c="dimmed">
              Add or select an element to edit it. Drag to move; drag the corner to resize.
            </Text>
          )}
        </Stack>
      </Group>

      <ThemeModal opened={themeOpen} onClose={themeCtl.close} theme={theme} fonts={meta?.fonts ?? []} onChange={setTheme} />
      <Modal opened={previewOpen} onClose={previewCtl.close} title="Preview (example data)" size="xl" centered>
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
  theme,
  ctx,
  pageRef,
  onSelect,
  onChange,
  onRemove,
}: {
  el: CanvasElement;
  selected: boolean;
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  pageRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
  onRemove: () => void;
}) {
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ex: number; ey: number; ew: number; eh: number } | null>(null);

  const start = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
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
    if (d.mode === 'move') {
      onChange({ x: clamp(d.ex + dxp, 0, 100 - el.w), y: clamp(d.ey + dyp, 0, 100 - el.h) });
    } else {
      onChange({ w: clamp(d.ew + dxp, 5, 100 - el.x), h: clamp(d.eh + dyp, 2, 100 - el.y) });
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
        cursor: 'move',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.outline = '1px dashed var(--mantine-color-gray-4)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.outline = '1px dashed transparent'; }}
    >
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <ElementView element={el} theme={theme} ctx={ctx} />
      </div>
      {selected && (
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
  onProp,
  onStyle,
  onGeom,
  variables,
  onInsertVar,
}: {
  el: CanvasElement;
  fonts: string[];
  onProp: (key: string, value: unknown) => void;
  onStyle: (patch: Partial<NonNullable<CanvasElement['style']>>) => void;
  onGeom: (patch: Partial<CanvasElement>) => void;
  variables: { key: string; label: string }[];
  onInsertVar: (key: string) => void;
}) {
  const s = el.style ?? {};
  const textLike = el.type === 'text' || el.type === 'heading';
  return (
    <Stack gap="sm">
      {/* Content */}
      {el.type === 'heading' && (
        <TextInput size="xs" label="Text" value={(el.props.text as string) ?? ''} onChange={(e) => onProp('text', e.currentTarget.value)} />
      )}
      {el.type === 'text' && (
        <Textarea size="xs" label="Text (HTML + {{variables}})" autosize minRows={3} maxRows={10} value={(el.props.html as string) ?? ''} onChange={(e) => onProp('html', e.currentTarget.value)} />
      )}
      {(el.type === 'image' || el.type === 'document') && (
        <TextInput size="xs" label="Field key" description="Optional — custom field to pull from; blank = choose per proposal." value={(el.props.fieldKey as string) ?? ''} onChange={(e) => onProp('fieldKey', e.currentTarget.value)} />
      )}
      {el.type === 'pricing' && (
        <Text size="xs" c="dimmed">
          Fills from the estimate(s) selected when building the proposal.
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
          <Group gap={4} wrap="wrap">
            <Text size="xs" c="dimmed">
              Insert:
            </Text>
            {variables.slice(0, 8).map((v) => (
              <Badge key={v.key} variant="light" color="candango" style={{ cursor: 'pointer', textTransform: 'none' }} onClick={() => onInsertVar(v.key)}>
                {v.label}
              </Badge>
            ))}
          </Group>
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
        <Button onClick={onClose}>Done</Button>
      </Stack>
    </Modal>
  );
}
