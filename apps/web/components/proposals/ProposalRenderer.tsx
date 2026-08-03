'use client';

import type { ReactNode } from 'react';
import type { ProposalRow, ProposalTheme } from '@/lib/api/proposals';

/**
 * Renders a proposal layout (rows → columns/areas → block) with a theme. The image/document/pricing
 * blocks resolve differently by context (example placeholders in the settings preview; real deal
 * data in the builder; the frozen snapshot on the public page), so those are supplied as render
 * helpers — keeping this component shared across all three.
 */
export interface ProposalRenderCtx {
  resolveText: (s: string) => string;
  image: (fieldKey?: string) => ReactNode;
  document: (fieldKey?: string) => ReactNode;
  pricing: () => ReactNode;
}

export function ProposalRenderer({
  layout,
  theme,
  ctx,
}: {
  layout: ProposalRow[];
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
}) {
  return (
    <div style={{ fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor, lineHeight: 1.5 }}>
      {layout.map((row) => (
        <div key={row.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          {row.columns.map((c) => (
            <div key={c.id} style={{ flex: c.width, minWidth: 0 }}>
              {c.block && <Block type={c.block.type} props={c.block.props} theme={theme} ctx={ctx} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Block({
  type,
  props,
  theme,
  ctx,
}: {
  type: string;
  props: Record<string, unknown>;
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
}) {
  if (type === 'cover') {
    return (
      <div
        style={{
          background: theme.coverStyle === 'image' ? 'var(--mantine-color-gray-2)' : theme.primaryColor,
          color: theme.coverStyle === 'image' ? theme.accentColor : '#fff',
          padding: '40px 32px',
          borderRadius: 10,
        }}
      >
        <div style={{ fontFamily: `${theme.fontHeading}, sans-serif`, fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>
          {ctx.resolveText((props.title as string) ?? '')}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 8, fontSize: 16, opacity: 0.92 }}>{ctx.resolveText((props.subtitle as string) ?? '')}</div>
        ) : null}
      </div>
    );
  }
  if (type === 'text') {
    return (
      <div
        style={{ fontSize: 15 }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: ctx.resolveText((props.html as string) ?? '') }}
      />
    );
  }
  if (type === 'image') return <>{ctx.image(props.fieldKey as string | undefined)}</>;
  if (type === 'document') return <>{ctx.document(props.fieldKey as string | undefined)}</>;
  if (type === 'pricing') return <>{ctx.pricing()}</>;
  return null;
}
