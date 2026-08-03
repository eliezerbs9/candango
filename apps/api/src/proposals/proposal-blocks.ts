/**
 * Proposal building blocks + theme options + starter templates. A template's `layout` is an ordered
 * list of rows; each row has 1–N columns (areas) on a 12-unit grid; each area holds one block.
 * Single source of truth — mirror the type list/labels in the web proposal editor.
 */

export type ProposalBlockType = 'cover' | 'text' | 'image' | 'document' | 'pricing';

export interface ProposalBlockDef {
  type: ProposalBlockType;
  label: string;
  description: string;
}

/** The palette shown in the layout editor. */
export const PROPOSAL_BLOCK_TYPES: ProposalBlockDef[] = [
  { type: 'cover', label: 'Cover', description: 'A hero header — title, subtitle, logo, background.' },
  { type: 'text', label: 'Text', description: 'Rich text with {{variables}}.' },
  { type: 'image', label: 'Image / Gallery', description: 'Photos, bound to a deal image custom field.' },
  { type: 'document', label: 'Document', description: 'Embed/attach a PDF from a deal document field.' },
  { type: 'pricing', label: 'Pricing table', description: 'Line items + totals from the selected estimate(s).' },
];

export const PROPOSAL_BLOCK_KEYS = PROPOSAL_BLOCK_TYPES.map((b) => b.type);

/** Curated fonts offered in the theme panel (loaded by the web app). */
export const PROPOSAL_FONTS = ['Inter', 'Bricolage Grotesque', 'Georgia', 'Space Mono', 'Arial'];

export interface ProposalTheme {
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  coverStyle: 'solid' | 'image';
  orientation: 'portrait' | 'landscape';
}

export const DEFAULT_THEME: ProposalTheme = {
  primaryColor: '#d9552c',
  accentColor: '#1f2933',
  fontHeading: 'Bricolage Grotesque',
  fontBody: 'Inter',
  coverStyle: 'solid',
  orientation: 'portrait',
};

// ── Starter templates (protected; always seeded) — free-canvas model ────────────
type ElStyle = { fontSize?: number; fontWeight?: number; color?: string; align?: string; background?: string };
type El = { id: string; type: string; x: number; y: number; w: number; h: number; props: Record<string, unknown>; style?: ElStyle };
type Page = { id: string; elements: El[] };

let n = 0;
const el = (type: string, x: number, y: number, w: number, h: number, props: Record<string, unknown> = {}, style?: ElStyle): El => ({
  id: `e${n++}`,
  type,
  x,
  y,
  w,
  h,
  props,
  style,
});
const page = (id: string, elements: El[]): Page => ({ id, elements });

export interface StarterTemplate {
  systemKey: string;
  name: string;
  theme: ProposalTheme;
  layout: Page[]; // ordered pages, each a set of absolutely-positioned elements (percent geometry)
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    systemKey: 'simple_estimate',
    name: 'Simple estimate',
    theme: DEFAULT_THEME,
    layout: [
      page('p1', [
        el('heading', 6, 6, 84, 9, { text: '{{deal.title}}' }, { fontSize: 34, fontWeight: 800 }),
        el('text', 6, 16, 84, 6, { html: 'Prepared for {{contact.name}}' }, { fontSize: 16, color: '#868e96' }),
        el('text', 6, 26, 84, 12, { html: '<p>Hi {{contact.first_name}}, thank you for the opportunity. Here is your estimate.</p>' }),
        el('pricing', 6, 44, 88, 34),
      ]),
    ],
  },
  {
    systemKey: 'photo_proposal',
    name: 'Photo-rich proposal',
    theme: { ...DEFAULT_THEME, coverStyle: 'image' },
    layout: [
      page('p1', [
        el('heading', 6, 8, 84, 10, { text: '{{deal.title}}' }, { fontSize: 38, fontWeight: 800 }),
        el('text', 6, 20, 84, 6, { html: '{{company.name}}' }, { fontSize: 18, color: '#868e96' }),
        el('image', 6, 32, 88, 50),
      ]),
      page('p2', [
        el('heading', 6, 6, 40, 7, { text: 'Scope of work' }, { fontSize: 22, fontWeight: 700 }),
        el('text', 6, 14, 40, 30, { html: '<p>Describe the work…</p>' }),
        el('heading', 52, 6, 42, 7, { text: 'What’s included' }, { fontSize: 22, fontWeight: 700 }),
        el('text', 52, 14, 42, 30, { html: '<p>List inclusions…</p>' }),
        el('pricing', 6, 50, 88, 28),
        el('document', 6, 82, 88, 8),
      ]),
    ],
  },
  {
    systemKey: 'service_agreement',
    name: 'Service agreement',
    theme: DEFAULT_THEME,
    layout: [
      page('p1', [
        el('heading', 6, 6, 84, 9, { text: 'Service Agreement' }, { fontSize: 32, fontWeight: 800 }),
        el('text', 6, 16, 84, 6, { html: '{{deal.title}} — {{contact.name}}' }, { fontSize: 15, color: '#868e96' }),
        el('text', 6, 26, 84, 30, { html: '<p>This agreement is between {{workspace.name}} and {{contact.name}}…</p>' }),
        el('pricing', 6, 60, 88, 22),
      ]),
    ],
  },
];
