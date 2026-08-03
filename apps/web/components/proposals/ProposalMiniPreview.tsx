'use client';

import { useEffect, useRef, useState } from 'react';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';

const isCanvasPage = (p: unknown): p is CanvasPage => !!p && Array.isArray((p as CanvasPage).elements);

/**
 * A faithful thumbnail of a proposal's first page. Renders the page at a reference width and scales
 * it down to fit the card, so fonts/images look proportional (unlike plain boxes).
 */
export function ProposalMiniPreview({ layout, theme, ctx }: { layout: unknown; theme: ProposalTheme; ctx: ProposalRenderCtx }) {
  const arr = Array.isArray(layout) ? layout : [];
  const page = arr.find(isCanvasPage);
  const landscape = theme.orientation === 'landscape';
  const ratio = landscape ? 11 / 8.5 : 8.5 / 11; // width / height
  const BASE = 800;

  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w ? w / BASE : 0;

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: landscape ? '11 / 8.5' : '8.5 / 11',
        background: '#fff',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {w > 0 && page && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: BASE,
            height: BASE / ratio,
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
      )}
    </div>
  );
}
