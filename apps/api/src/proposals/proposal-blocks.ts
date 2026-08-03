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
}

export const DEFAULT_THEME: ProposalTheme = {
  primaryColor: '#d9552c',
  accentColor: '#1f2933',
  fontHeading: 'Bricolage Grotesque',
  fontBody: 'Inter',
  coverStyle: 'solid',
};

// ── Starter templates (protected; always seeded) ───────────────────────────────
type Col = { id: string; width: number; block: { type: ProposalBlockType; props: Record<string, unknown> } | null };
type Row = { id: string; columns: Col[] };

const row = (id: string, columns: Col[]): Row => ({ id, columns });
const col = (id: string, width: number, type: ProposalBlockType, props: Record<string, unknown> = {}): Col => ({
  id,
  width,
  block: { type, props },
});

export interface StarterTemplate {
  systemKey: string;
  name: string;
  theme: ProposalTheme;
  layout: Row[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    systemKey: 'simple_estimate',
    name: 'Simple estimate',
    theme: DEFAULT_THEME,
    layout: [
      row('r1', [col('c1', 12, 'cover', { title: '{{deal.title}}', subtitle: 'Prepared for {{contact.name}}' })]),
      row('r2', [col('c1', 12, 'text', { html: '<p>Hi {{contact.first_name}}, thank you for the opportunity. Here is your estimate.</p>' })]),
      row('r3', [col('c1', 12, 'pricing', {})]),
    ],
  },
  {
    systemKey: 'photo_proposal',
    name: 'Photo-rich proposal',
    theme: { ...DEFAULT_THEME, coverStyle: 'image' },
    layout: [
      row('r1', [col('c1', 12, 'cover', { title: '{{deal.title}}', subtitle: '{{company.name}}' })]),
      row('r2', [col('c1', 12, 'image', {})]),
      row('r3', [col('c1', 6, 'text', { html: '<p>Scope of work…</p>' }), col('c2', 6, 'text', { html: '<p>What’s included…</p>' })]),
      row('r4', [col('c1', 12, 'pricing', {})]),
      row('r5', [col('c1', 12, 'document', {})]),
    ],
  },
  {
    systemKey: 'service_agreement',
    name: 'Service agreement',
    theme: DEFAULT_THEME,
    layout: [
      row('r1', [col('c1', 12, 'cover', { title: 'Service Agreement', subtitle: '{{deal.title}} — {{contact.name}}' })]),
      row('r2', [col('c1', 12, 'text', { html: '<p>This agreement is between {{workspace.name}} and {{contact.name}}…</p>' })]),
      row('r3', [col('c1', 12, 'pricing', {})]),
    ],
  },
];
