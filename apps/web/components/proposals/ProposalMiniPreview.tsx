'use client';

import { useEffect, useRef, useState } from 'react';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';

const isCanvasPage = (p: unknown): p is CanvasPage => !!p && Array.isArray((p as CanvasPage).elements);

/**
 * A faithful thumbnail of a proposal's first page. Renders the page at a reference width and scales
 * it to fit the box, so fonts/images look proportional. With `height` it letterboxes to a fixed box
 * (uniform card heights); otherwise it uses the page aspect ratio.
 */
export function ProposalMiniPreview({
  layout,
  theme,
  ctx,
  height,
}: {
  layout: unknown;
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  height?: number;
}) {
  const arr = Array.isArray(layout) ? layout : [];
  const page = arr.find(isCanvasPage);
  const landscape = theme.orientation === 'landscape';
  const ratio = landscape ? 11 / 8.5 : 8.5 / 11; // width / height
  const BASE = 800;
  const baseH = BASE / ratio;

  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the reference page inside the measured box (letterbox when a fixed height is given).
  const scale = box.w > 0 ? (height ? Math.min(box.w / BASE, box.h / baseH) : box.w / BASE) : 0;
  const scaledW = BASE * scale;
  const scaledH = baseH * scale;

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: '100%',
        ...(height ? { height } : { aspectRatio: landscape ? '11 / 8.5' : '8.5 / 11' }),
        background: '#fff',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {box.w > 0 && page && (
        <div style={{ position: 'relative', width: scaledW, height: scaledH }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: BASE,
              height: baseH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              fontFamily: `${theme.fontBody}, sans-serif`,
              color: theme.accentColor,
            }}
          >
            {page.elements.map((el) => (
              <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` }}>
                <ElementView element={el} theme={theme} ctx={ctx} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
