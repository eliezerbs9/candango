import { apiFetch } from './client';

export type ProposalBlockType = 'cover' | 'text' | 'image' | 'document' | 'pricing';

export interface ProposalBlock {
  type: ProposalBlockType;
  props: Record<string, unknown>;
}

export interface ProposalColumn {
  id: string;
  width: number; // 12-unit grid
  block: ProposalBlock | null;
}

export interface ProposalRow {
  id: string;
  columns: ProposalColumn[];
}

/** Legacy flow page (pre free-canvas) — still rendered for old templates. */
export interface ProposalPage {
  id: string;
  rows: ProposalRow[];
}

// ── Free-canvas model ──────────────────────────────────────────────────────────
export type Orientation = 'portrait' | 'landscape';
export type ElementType = 'text' | 'heading' | 'image' | 'document' | 'pricing' | 'divider' | 'logo' | 'field';
/** Signature-field sub-type carried in a 'field' element's props (signable documents only). */
export type SignFieldType = 'signature' | 'initials' | 'date' | 'text';

export interface ElementStyle {
  fontSize?: number; // px
  fontWeight?: number;
  lineHeight?: number; // unitless line-height multiplier
  color?: string;
  align?: 'left' | 'center' | 'right';
  background?: string;
  radius?: number;
  padding?: number;
}

/** An absolutely-positioned element. x/y/w/h are percentages (0–100) of the page. */
export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, unknown>;
  style?: ElementStyle;
}

export interface CanvasPage {
  id: string;
  elements: CanvasElement[];
  /** Full-page background image (file key) — e.g. a page imported from a PDF. Elements sit on top. */
  background?: string;
}

// ── Page geometry ────────────────────────────────────────────────────────────
// The page is authored at a FIXED reference size and uniformly scaled to fit wherever it renders
// (editor, preview, presentation, thumbnails). That keeps fonts, spacing and positions identical
// across every surface — the presentation matches the template exactly. Landscape uses 16:9 so it
// fits tablets/phones/monitors in landscape; portrait stays US-Letter.
// Signable documents pick a real paper size (Letter/A4); proposals have none → screen geometry
// (portrait US-Letter, landscape 16:9). @96dpi: Letter 816×1056, A4 794×1123.
const PAPER: Record<string, { w: number; h: number }> = {
  letter: { w: 816, h: 1056 },
  a4: { w: 794, h: 1123 },
};
export function pageDims(orientation?: string, paperSize?: string): { w: number; h: number } {
  const base = paperSize && PAPER[paperSize] ? PAPER[paperSize] : orientation === 'landscape' ? { w: 1280, h: 720 } : { w: 816, h: 1056 };
  // A chosen paper size rotates with orientation; the proposal (no paper) landscape is already 16:9.
  return paperSize && PAPER[paperSize] && orientation === 'landscape' ? { w: base.h, h: base.w } : base;
}
export function pageAspectCss(orientation?: string, paperSize?: string): string {
  const { w, h } = pageDims(orientation, paperSize);
  return `${w} / ${h}`;
}

export interface ProposalTheme {
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  coverStyle: 'solid' | 'image';
  orientation?: Orientation;
  /** Real paper size for signable documents ('letter' | 'a4'); absent for proposals (screen geometry). */
  paperSize?: 'letter' | 'a4';
  /** Optional safe-area margin (percent of the page) shown as a design guide in the editor. */
  margin?: number;
  /**
   * How the recipient views it:
   *  - 'slides' = one page per slide in a framed deck with nav
   *  - 'fullscreen' = immersive, one slide fitted to the whole screen
   *  - 'scroll' = continuous
   */
  present?: 'slides' | 'fullscreen' | 'scroll';
  /** Transition between slides. */
  transition?: 'none' | 'fade' | 'slide';
  /** Animate elements into view as each slide appears. */
  animate?: boolean;
  /** Backdrop color behind the page in slides / full-screen presentation. */
  presentBg?: string;
}

/** An internal (rep-filled, client-hidden) proposal field — defined on a template, snapshotted per proposal. */
export type ProposalFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'image'
  | 'document'
  | 'signature_template'
  | 'estimate'
  | 'invoice';
export interface ProposalFieldDef {
  key: string;
  label: string;
  type: ProposalFieldType;
  required?: boolean;
  options?: string[];
  /** For `document`/`image` fields: the deal custom-field key this binds to (its value lives on the deal). */
  customFieldKey?: string;
  /** For file/pricing fields: allow more than one (default true). `false` = exactly one. */
  multiple?: boolean;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  theme: ProposalTheme;
  layout: CanvasPage[];
  fields: ProposalFieldDef[];
  emailTemplateId: string | null;
  systemKey: string | null;
  system: boolean;
  updatedAt: string;
}

export interface ProposalMeta {
  blocks: { type: ProposalBlockType; label: string; description: string }[];
  fonts: string[];
  defaultTheme: ProposalTheme;
}

export interface ProposalTemplateBody {
  name?: string;
  theme?: ProposalTheme;
  layout?: CanvasPage[];
  fields?: ProposalFieldDef[];
  emailTemplateId?: string;
}

export function getProposalMeta(token: string) {
  return apiFetch<ProposalMeta>('/proposal-templates/meta', { token });
}

export function getProposalTemplates(token: string) {
  return apiFetch<ProposalTemplate[]>('/proposal-templates', { token });
}

export function getProposalTemplate(token: string, id: string) {
  return apiFetch<ProposalTemplate>(`/proposal-templates/${id}`, { token });
}

export function createProposalTemplate(token: string, body: ProposalTemplateBody) {
  return apiFetch<ProposalTemplate>('/proposal-templates', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateProposalTemplate(token: string, id: string, body: ProposalTemplateBody) {
  return apiFetch<ProposalTemplate>(`/proposal-templates/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteProposalTemplate(token: string, id: string) {
  return apiFetch<void>(`/proposal-templates/${id}`, { method: 'DELETE', token });
}

export function seedProposalTemplates(token: string) {
  return apiFetch<ProposalTemplate[]>('/proposal-templates/seed-defaults', { method: 'POST', token });
}

// ── Proposals (per-deal instances) ─────────────────────────────────────────────
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'denied' | 'deferred';

export interface Proposal {
  id: string;
  dealId: string;
  templateId: string | null;
  emailTemplateId: string | null;
  title: string;
  theme: ProposalTheme;
  content: CanvasPage[];
  fields: ProposalFieldDef[];
  fieldValues: Record<string, unknown>;
  estimateIds: string[];
  status: ProposalStatus;
  shareToken: string;
  feedback: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Sum of the selected estimates (cents) — present on the deal list response. */
  total?: number;
  currency?: string;
}

export interface ProposalImageFile {
  key: string;
  url: string;
}
export interface ProposalDocFile {
  key: string;
  name: string;
  url: string;
}

/** A resolved pricing table (line-item rows + total) for a document or the aggregate. */
export interface PricingTable {
  currency: string;
  rows: { description: string; amount: number }[];
  total: number;
}

/** A document a pricing element pulls in (stored in the element's `props.docs`). */
export type PricingDocRef = { kind: 'estimate' | 'invoice'; id: string };

/** The resolved render data (no proposal fields) — enough to build a render context. */
export interface ProposalRenderCore {
  variables: Record<string, string>;
  imagesByField: Record<string, ProposalImageFile[]>;
  documentsByField: Record<string, ProposalDocFile[]>;
  logoUrl: string | null;
  /** Signed URLs for template-owned uploaded files (image/document "fixed" source), keyed by object key. */
  fixedFilesByKey: Record<string, string>;
  /** Proposal-level aggregate pricing (fallback for pricing elements without their own `docs`). */
  pricing: PricingTable;
  /** Per-document pricing (estimate/invoice) keyed by id — for pricing elements that reference specific docs. */
  pricingByDoc: Record<string, PricingTable>;
}

/** A proposal + the resolved render data (variables, signed file URLs, pricing). */
export interface ProposalRenderData extends Proposal, ProposalRenderCore {}

export interface ProposalBody {
  dealId?: string;
  templateId?: string;
  title?: string;
  estimateIds?: string[];
  content?: CanvasPage[];
  theme?: ProposalTheme;
  /** Rep-filled values for the proposal's internal (client-hidden) fields. */
  fieldValues?: Record<string, unknown>;
  status?: ProposalStatus;
  /** Reason — required when the user sets status to denied or deferred. */
  feedback?: string;
}

export function getDealProposals(token: string, dealId: string) {
  return apiFetch<Proposal[]>(`/proposals?dealId=${encodeURIComponent(dealId)}`, { token });
}

export function getProposalRender(token: string, id: string) {
  return apiFetch<ProposalRenderData>(`/proposals/${id}/render`, { token });
}

/** Real render data for a deal, to preview a template against actual data. */
export function getProposalPreviewData(token: string, dealId: string) {
  return apiFetch<ProposalRenderCore>(`/proposals/preview-data?dealId=${encodeURIComponent(dealId)}`, { token });
}

export function createProposal(token: string, body: ProposalBody) {
  return apiFetch<Proposal>('/proposals', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateProposal(token: string, id: string, body: ProposalBody) {
  return apiFetch<Proposal>(`/proposals/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteProposal(token: string, id: string) {
  return apiFetch<void>(`/proposals/${id}`, { method: 'DELETE', token });
}

export interface SentProposal extends Proposal {
  link: string;
  emailed: boolean;
}

export function sendProposal(token: string, id: string, to?: string[]) {
  return apiFetch<SentProposal>(`/proposals/${id}/send`, { method: 'POST', token, body: JSON.stringify({ to }) });
}
