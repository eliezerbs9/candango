'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { IconCalendar, IconLetterCase, IconSignature, IconTrash, IconWriting } from '@tabler/icons-react';
import type { DrawnField } from '@/lib/api/signature-templates';

type FieldType = DrawnField['type'];

/** Palette of placeable fields + their default box size (normalized to the page). */
const PALETTE: { type: FieldType; label: string; icon: typeof IconSignature; w: number; h: number }[] = [
  { type: 'signature', label: 'Signature', icon: IconSignature, w: 0.28, h: 0.06 },
  { type: 'initials', label: 'Initials', icon: IconWriting, w: 0.12, h: 0.05 },
  { type: 'date', label: 'Date', icon: IconCalendar, w: 0.18, h: 0.045 },
  { type: 'text', label: 'Text', icon: IconLetterCase, w: 0.24, h: 0.045 },
];

const COLORS: Record<FieldType, string> = {
  signature: 'var(--mantine-color-candango-6)',
  initials: 'var(--mantine-color-violet-6)',
  date: 'var(--mantine-color-teal-6)',
  text: 'var(--mantine-color-blue-6)',
  checkbox: 'var(--mantine-color-gray-6)',
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

interface PageDim {
  width: number;
  height: number;
}
type IdField = DrawnField & { _id: string };
type Drag = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number }; rectW: number; rectH: number };

/**
 * Render a PDF's pages (pdf.js) and let the user drop/drag/resize signature fields onto them.
 * Emits DrawnField[] with normalized top-left coords (page 1-indexed) — the shape DocuSeal expects.
 */
export function SignatureFieldEditor({ fileUrl, value, onChange }: { fileUrl: string; value: DrawnField[]; onChange: (f: DrawnField[]) => void }) {
  const [pages, setPages] = useState<PageDim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);

  // Keep an id on each field for stable React keys + drag targeting; strip it on emit.
  const [fields, setFields] = useState<IdField[]>(() => value.map((f) => ({ ...f, _id: uid() })));
  const emit = (next: IdField[]) => {
    setFields(next);
    onChange(next.map(({ _id, label, ...rest }) => ({ ...rest, ...(label ? { label } : {}) })));
  };

  useEffect(() => {
    let cancelled = false;
    const tasks: { cancel: () => void }[] = [];
    (async () => {
      setLoading(true);
      setError(null);
      setPages([]);
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        const dims: PageDim[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          dims.push({ width: vp.width, height: vp.height });
        }
        if (cancelled) return;
        setPages(dims);
        // Second pass: render each page into its (now mounted) canvas at a crisp scale.
        requestAnimationFrame(async () => {
          for (let i = 1; i <= doc.numPages && !cancelled; i++) {
            const canvas = canvasRefs.current[i - 1];
            if (!canvas) continue;
            const page = await doc.getPage(i);
            const scale = (760 * (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1)) / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const task = page.render({ canvasContext: ctx, viewport });
              tasks.push(task);
              await task.promise.catch(() => {});
            }
          }
          if (!cancelled) setLoading(false);
        });
      } catch {
        if (!cancelled) {
          setError('Could not render this document for field placement.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [fileUrl]);

  const addField = (type: FieldType) => {
    const def = PALETTE.find((p) => p.type === type)!;
    emit([...fields, { _id: uid(), type, page: activePage, x: 0.5 - def.w / 2, y: 0.45, w: def.w, h: def.h }]);
  };
  const removeField = (id: string) => emit(fields.filter((f) => f._id !== id));

  const onPointerDown = (e: React.PointerEvent, f: IdField, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    const rect = pageRefs.current[f.page - 1]?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: f._id, mode, startX: e.clientX, startY: e.clientY, orig: { x: f.x, y: f.y, w: f.w, h: f.h }, rectW: rect.width, rectH: rect.height };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rectW;
    const dy = (e.clientY - d.startY) / d.rectH;
    setFields((prev) =>
      prev.map((f) => {
        if (f._id !== d.id) return f;
        if (d.mode === 'move') {
          return { ...f, x: clamp(d.orig.x + dx, 0, 1 - f.w), y: clamp(d.orig.y + dy, 0, 1 - f.h) };
        }
        return { ...f, w: clamp(d.orig.w + dx, 0.04, 1 - f.x), h: clamp(d.orig.h + dy, 0.02, 1 - f.y) };
      }),
    );
  };
  const onPointerUp = () => {
    if (drag.current) {
      drag.current = null;
      onChange(fields.map(({ _id, label, ...rest }) => ({ ...rest, ...(label ? { label } : {}) })));
    }
  };

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm" fw={500}>
          Add field:
        </Text>
        {PALETTE.map((p) => (
          <Button key={p.type} size="compact-xs" variant="light" leftSection={<p.icon size={13} />} onClick={() => addField(p.type)} disabled={loading || !!error}>
            {p.label}
          </Button>
        ))}
      </Group>
      <Text size="xs" c="dimmed">
        New fields land on <b>page {activePage}</b> — click a page to target it, then drag to move and use the corner to resize.
      </Text>

      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : loading && pages.length === 0 ? (
        <Group justify="center" py="lg">
          <Loader size="sm" />
        </Group>
      ) : (
        <Stack gap="md" align="center" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {pages.map((dim, pi) => {
            const pageNo = pi + 1;
            const isActive = pageNo === activePage;
            return (
              <div key={pageNo} style={{ width: '100%', maxWidth: dim.width, position: 'relative' }}>
                <Text size="xs" c="dimmed" mb={2}>
                  Page {pageNo}
                </Text>
                <Paper
                  ref={(el) => {
                    pageRefs.current[pi] = el;
                  }}
                  withBorder
                  radius="sm"
                  onPointerDown={() => setActivePage(pageNo)}
                  style={{ position: 'relative', overflow: 'hidden', outline: isActive ? '2px solid var(--mantine-color-candango-4)' : 'none', aspectRatio: `${dim.width} / ${dim.height}`, touchAction: 'none' }}
                >
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[pi] = el;
                    }}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  />
                  {fields
                    .filter((f) => f.page === pageNo)
                    .map((f) => (
                      <div
                        key={f._id}
                        onPointerDown={(e) => onPointerDown(e, f, 'move')}
                        style={{
                          position: 'absolute',
                          left: `${f.x * 100}%`,
                          top: `${f.y * 100}%`,
                          width: `${f.w * 100}%`,
                          height: `${f.h * 100}%`,
                          border: `1.5px solid ${COLORS[f.type]}`,
                          background: 'color-mix(in srgb, var(--mantine-color-body) 55%, transparent)',
                          borderRadius: 3,
                          cursor: 'move',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 600,
                          color: COLORS[f.type],
                          textTransform: 'capitalize',
                          userSelect: 'none',
                        }}
                      >
                        {f.type}
                        <ActionIcon
                          size={14}
                          color="red"
                          variant="filled"
                          style={{ position: 'absolute', top: -8, right: -8 }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            removeField(f._id);
                          }}
                          aria-label="Remove field"
                        >
                          <IconTrash size={9} />
                        </ActionIcon>
                        <div
                          onPointerDown={(e) => onPointerDown(e, f, 'resize')}
                          style={{ position: 'absolute', bottom: -5, right: -5, width: 11, height: 11, background: COLORS[f.type], borderRadius: 2, cursor: 'nwse-resize' }}
                        />
                      </div>
                    ))}
                </Paper>
              </div>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
