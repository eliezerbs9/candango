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
export type ElementType = 'text' | 'heading' | 'image' | 'document' | 'pricing' | 'divider' | 'logo';

export interface ElementStyle {
  fontSize?: number; // px
  fontWeight?: number;
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
}

export interface ProposalTheme {
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  coverStyle: 'solid' | 'image';
  orientation?: Orientation;
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

export interface ProposalTemplate {
  id: string;
  name: string;
  theme: ProposalTheme;
  layout: CanvasPage[];
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
  title: string;
  theme: ProposalTheme;
  content: CanvasPage[];
  estimateIds: string[];
  status: ProposalStatus;
  shareToken: string;
  feedback: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
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

/** The resolved render data (no proposal fields) — enough to build a render context. */
export interface ProposalRenderCore {
  variables: Record<string, string>;
  imagesByField: Record<string, ProposalImageFile[]>;
  documentsByField: Record<string, ProposalDocFile[]>;
  logoUrl: string | null;
  /** Signed URLs for template-owned uploaded files (image/document "fixed" source), keyed by object key. */
  fixedFilesByKey: Record<string, string>;
  pricing: { currency: string; rows: { description: string; amount: number }[]; total: number };
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
  status?: ProposalStatus;
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
