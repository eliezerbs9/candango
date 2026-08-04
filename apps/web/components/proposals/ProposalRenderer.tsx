'use client';

import type { CSSProperties } from 'react';
import { pageAspectCss, type CanvasElement, type CanvasPage, type ProposalPage, type ProposalRow, type ProposalTheme } from '@/lib/api/proposals';

/**
 * Renders a proposal — free-canvas pages of absolutely-positioned elements (with a legacy flow
 * fallback for pre-canvas templates). The image/document/pricing content resolves differently by
 * context (example placeholders / real deal data / public snapshot), so those come via a ctx.
 */
/** How an image/document element fills from its field's files. */
export type MediaPick = 'recent' | 'oldest' | 'manual';
export interface ProposalImageOpts {
  fieldKey?: string;
  cols?: number;
  count?: number;
  pick?: MediaPick;
  picked?: string[];
  /** When set (template-owned "fixed" source), render exactly these image URLs. */
  urls?: string[];
}
export interface ProposalDocOpts {
  fieldKey?: string;
  pick?: MediaPick;
  picked?: string[];
  /** Show a single document (field source); off shows the whole selection. */
  single?: boolean;
  /** When set (template-owned "fixed" source), render exactly these documents. */
  docs?: { name?: string; url: string }[];
}
export interface ProposalRenderCtx {
  resolveText: (s: string) => string;
  image: (opts: ProposalImageOpts) => React.ReactNode;
  document: (opts: ProposalDocOpts) => React.ReactNode;
  pricing: () => React.ReactNode;
  logo: (opts?: { fit?: 'contain' | 'cover' }) => React.ReactNode;
  /** Resolve a stored object key to a signed URL (for template-owned uploaded files). */
  fileUrl: (key: string) => string | undefined;
}

/** Resolve a fixed element's uploaded files to signed URLs via the ctx. */
export function fixedImageUrls(props: Record<string, unknown>, ctx: ProposalRenderCtx): string[] | undefined {
  if (props.source !== 'fixed') return undefined;
  return ((props.files as { key: string }[] | undefined) ?? [])
    .map((f) => ctx.fileUrl(f.key))
    .filter((u): u is string => !!u);
}
export function fixedDocs(props: Record<string, unknown>, ctx: ProposalRenderCtx): { name?: string; url: string }[] | undefined {
  if (props.source !== 'fixed') return undefined;
  const out: { name?: string; url: string }[] = [];
  for (const f of (props.files as { key: string; name?: string }[] | undefined) ?? []) {
    const url = ctx.fileUrl(f.key);
    if (url) out.push({ name: f.name, url });
  }
  return out;
}

const isCanvasPage = (p: unknown): p is CanvasPage => !!p && Array.isArray((p as CanvasPage).elements);

function normalize(layout: unknown): (CanvasPage | ProposalPage)[] {
  const arr = Array.isArray(layout) ? layout : [];
  if (arr.length === 0) return [];
  if (arr[0] && typeof arr[0] === 'object' && 'columns' in (arr[0] as object)) {
    return [{ id: 'p1', rows: arr as ProposalRow[] }]; // very old flat rows
  }
  return arr as (CanvasPage | ProposalPage)[];
}

/** Renders one element's content, filling its positioned box. Shared with the editor for WYSIWYG. */
export function ElementView({ element, theme, ctx }: { element: CanvasElement; theme: ProposalTheme; ctx: ProposalRenderCtx }) {
  const s = element.style ?? {};
  // Text/heading/document may exceed their box — let them spill instead of clipping content.
  const textLike = element.type === 'text' || element.type === 'heading' || element.type === 'document';
  const base: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: textLike ? 'visible' : 'hidden',
    color: s.color ?? theme.accentColor,
    textAlign: s.align ?? 'left',
    background: s.background,
    borderRadius: s.radius,
    padding: s.padding ?? 0,
    boxSizing: 'border-box',
  };
  switch (element.type) {
    case 'heading':
      return (
        <div style={{ ...base, fontFamily: `${theme.fontHeading}, sans-serif`, fontSize: s.fontSize ?? 28, fontWeight: s.fontWeight ?? 800, lineHeight: 1.15 }}>
          {ctx.resolveText(String(element.props.text ?? ''))}
        </div>
      );
    case 'text': {
      const cols = Number(element.props.columns) === 2;
      const colGap = (element.props.colGap as number) ?? 24;
      return (
        <div
          style={{
            ...base,
            fontSize: s.fontSize ?? 15,
            fontWeight: s.fontWeight ?? 400,
            lineHeight: 1.5,
            ...(cols ? { columnCount: 2, columnGap: colGap } : {}),
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: ctx.resolveText(String(element.props.html ?? '')) }}
        />
      );
    }
    case 'image':
      return (
        <div style={base}>
          {ctx.image({
            fieldKey: element.props.fieldKey as string | undefined,
            cols: element.props.cols as number | undefined,
            count: element.props.count as number | undefined,
            pick: element.props.pick as MediaPick | undefined,
            picked: element.props.picked as string[] | undefined,
            urls: fixedImageUrls(element.props, ctx),
          })}
        </div>
      );
    case 'document':
      return (
        <div style={base}>
          {ctx.document({
            fieldKey: element.props.fieldKey as string | undefined,
            pick: element.props.pick as MediaPick | undefined,
            picked: element.props.picked as string[] | undefined,
            single: element.props.single !== false,
            docs: fixedDocs(element.props, ctx),
          })}
        </div>
      );
    case 'pricing':
      return <div style={{ ...base, fontSize: s.fontSize ?? 14 }}>{ctx.pricing()}</div>;
    case 'logo':
      return <div style={base}>{ctx.logo({ fit: (element.props.fit as 'contain' | 'cover' | undefined) ?? 'contain' })}</div>;
    case 'divider':
      return <div style={{ width: '100%', borderTop: `2px solid ${s.color ?? '#dee2e6'}` }} />;
    case 'field': {
      // A signature field placeholder (signable documents) — becomes a real DocuSeal field on send.
      const ft = (element.props.fieldType as string) || 'signature';
      const label = ft.charAt(0).toUpperCase() + ft.slice(1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: `1.5px dashed ${theme.primaryColor}`,
            borderRadius: 4,
            background: `color-mix(in srgb, ${theme.primaryColor} 8%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.primaryColor,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      );
    }
    default:
      return null;
  }
}

export function ProposalRenderer({
  layout,
  theme,
  ctx,
  paged = false,
}: {
  layout: unknown;
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  paged?: boolean;
}) {
  const pages = normalize(layout);
  return (
    <div style={{ fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor, lineHeight: 1.5 }}>
      {pages.map((page, i) =>
        isCanvasPage(page) ? (
          <div
            key={page.id}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: pageAspectCss(theme.orientation, theme.paperSize),
              background: '#fff',
              borderRadius: paged ? 10 : 0,
              boxShadow: paged ? '0 1px 6px rgba(0,0,0,0.1)' : undefined,
              marginBottom: paged ? 24 : 0,
              overflow: 'hidden',
            }}
          >
            {page.elements.map((el) => (
              <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` }}>
                <ElementView element={el} theme={theme} ctx={ctx} />
              </div>
            ))}
          </div>
        ) : (
          <LegacyFlow key={(page as ProposalPage).id ?? i} page={page as ProposalPage} theme={theme} ctx={ctx} />
        ),
      )}
    </div>
  );
}

/** Renders a pre-canvas flow page (rows → columns → block). */
function LegacyFlow({ page, theme, ctx }: { page: ProposalPage; theme: ProposalTheme; ctx: ProposalRenderCtx }) {
  const block = (type: string, props: Record<string, unknown>) => {
    if (type === 'cover')
      return (
        <div style={{ background: theme.primaryColor, color: '#fff', padding: '40px 32px', borderRadius: 10 }}>
          <div style={{ fontFamily: `${theme.fontHeading}, sans-serif`, fontSize: 30, fontWeight: 800 }}>{ctx.resolveText(String(props.title ?? ''))}</div>
          {props.subtitle ? <div style={{ marginTop: 8, opacity: 0.92 }}>{ctx.resolveText(String(props.subtitle))}</div> : null}
        </div>
      );
    if (type === 'text') return <div dangerouslySetInnerHTML={{ __html: ctx.resolveText(String(props.html ?? '')) }} />;
    if (type === 'image') return <>{ctx.image({ fieldKey: props.fieldKey as string | undefined })}</>;
    if (type === 'document') return <>{ctx.document({ fieldKey: props.fieldKey as string | undefined })}</>;
    if (type === 'pricing') return <>{ctx.pricing()}</>;
    return null;
  };
  return (
    <>
      {page.rows.map((row) => (
        <div key={row.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          {row.columns.map((c) => (
            <div key={c.id} style={{ flex: c.width, minWidth: 0 }}>
              {c.block && block(c.block.type, c.block.props)}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
