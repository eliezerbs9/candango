'use client';

import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';
import { PageSurface } from './PageSurface';

const isCanvasPage = (p: unknown): p is CanvasPage => !!p && Array.isArray((p as CanvasPage).elements);

/**
 * A faithful thumbnail of a proposal's first page — rendered via the shared PageSurface so it scales
 * exactly like the editor/presentation. With `height` it letterboxes to a fixed box (uniform cards).
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
  const page = (Array.isArray(layout) ? layout : []).find(isCanvasPage);
  return (
    <div
      style={{
        width: '100%',
        ...(height ? { height } : {}),
        background: '#fff',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <PageSurface orientation={theme.orientation} fit={height ? 'contain' : 'width'} surfaceStyle={{ fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor }}>
        {page?.elements.map((el) => (
          <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` }}>
            <ElementView element={el} theme={theme} ctx={ctx} />
          </div>
        ))}
      </PageSurface>
    </div>
  );
}
