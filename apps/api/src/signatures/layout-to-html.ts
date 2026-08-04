import { renderTemplate } from '../email-templates/template-vars';

/**
 * Renders a free-canvas document layout (the same CanvasPage[] model the proposal builder uses) to
 * self-contained HTML for DocuSeal's HTML API. Pages are fixed-size US-Letter boxes; elements are
 * absolutely positioned by percentage — so the generated PDF matches the builder 1:1. Signature
 * "field" elements become DocuSeal field tags (<signature-field>, <date-field>, …) at their spot.
 *
 * v1 scope: heading / text / logo / divider / field. image / document / pricing elements (which pull
 * from a deal's files/estimates) are skipped in generated documents for now.
 */

// Paper sizes @96dpi (must match apps/web pageDims): Letter 816×1056, A4 794×1123.
const PAPER: Record<string, { w: number; h: number }> = {
  letter: { w: 816, h: 1056 },
  a4: { w: 794, h: 1123 },
};
function pageSize(paperSize?: string, orientation?: string): { w: number; h: number } {
  const base = paperSize && PAPER[paperSize] ? PAPER[paperSize] : PAPER.letter;
  return orientation === 'landscape' ? { w: base.h, h: base.w } : base;
}
const FIELD_TYPES = ['signature', 'initials', 'date', 'text'] as const;

interface ElStyle {
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: string;
  background?: string;
  radius?: number;
  padding?: number;
}
interface El {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, unknown>;
  style?: ElStyle;
}
interface Page {
  id: string;
  elements: El[];
}
interface Theme {
  accentColor?: string;
  fontHeading?: string;
  fontBody?: string;
  orientation?: string;
  paperSize?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fieldName = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`;

function renderEl(el: El, theme: Theme, vars: Record<string, string>, logoUrl?: string | null): string {
  const box = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;`;
  const s = el.style ?? {};
  const common =
    `${box}color:${s.color ?? theme.accentColor ?? '#1a1a1a'};text-align:${s.align ?? 'left'};` +
    `${s.background ? `background:${s.background};` : ''}${s.radius ? `border-radius:${s.radius}px;` : ''}padding:${s.padding ?? 0}px;box-sizing:border-box;`;

  switch (el.type) {
    case 'heading':
      return `<div style="${common}font-family:${esc(theme.fontHeading ?? 'Helvetica')},sans-serif;font-size:${s.fontSize ?? 28}px;font-weight:${s.fontWeight ?? 800};line-height:1.15">${esc(renderTemplate(String(el.props.text ?? ''), vars))}</div>`;
    case 'text': {
      // Rich-text HTML authored in the builder — variables still resolve; markup is intentional.
      const cols = Number(el.props.columns) === 2 ? `column-count:2;column-gap:${Number(el.props.colGap ?? 24)}px;` : '';
      return `<div style="${common}font-size:${s.fontSize ?? 15}px;font-weight:${s.fontWeight ?? 400};line-height:1.5;${cols}">${renderTemplate(String(el.props.html ?? ''), vars)}</div>`;
    }
    case 'logo':
      return logoUrl ? `<div style="${box}"><img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:${el.props.fit === 'cover' ? 'cover' : 'contain'}"/></div>` : '';
    case 'divider':
      return `<div style="${box}display:flex;align-items:center"><div style="width:100%;border-top:2px solid ${s.color ?? '#dee2e6'}"></div></div>`;
    // 'field' elements aren't rendered into the content — signatures are placed on the appended
    // Acceptance & Signature page instead. image / document / pricing are deferred too.
    default:
      return '';
  }
}

export function layoutToHtml(
  layout: unknown,
  theme: Theme | null | undefined,
  vars: Record<string, string>,
  logoUrl?: string | null,
): string {
  const pages = (Array.isArray(layout) ? layout : []) as Page[];
  const t = theme ?? {};
  const dims = pageSize(t.paperSize, t.orientation);
  const pageName = t.paperSize === 'a4' ? 'A4' : 'letter';
  const pageRule = `@page{size:${pageName} ${t.orientation === 'landscape' ? 'landscape' : 'portrait'};margin:0}`;
  const body = pages
    .map((pg, i) => {
      const els = (pg.elements ?? []).map((el) => renderEl(el, t, vars, logoUrl)).join('');
      const brk = i < pages.length - 1 ? 'page-break-after:always;' : '';
      return `<div style="position:relative;width:${dims.w}px;height:${dims.h}px;background:#fff;overflow:hidden;${brk}">${els}</div>`;
    })
    .join('');
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<style>${pageRule}*{box-sizing:border-box}body{margin:0;font-family:${esc(t.fontBody ?? 'Helvetica')},Arial,sans-serif;color:${esc(t.accentColor ?? '#1a1a1a')}}</style>` +
    `</head><body>${body}</body></html>`
  );
}

/** DocuSeal page-size string for a theme's paper size. */
export function docusealSize(theme: { paperSize?: string } | null | undefined): string {
  return theme?.paperSize === 'a4' ? 'A4' : 'Letter';
}

/** True when the layout declares at least one signature field (else the caller appends a default block). */
export function layoutHasField(layout: unknown): boolean {
  const pages = (Array.isArray(layout) ? layout : []) as Page[];
  return pages.some((pg) => (pg.elements ?? []).some((el) => el.type === 'field'));
}
