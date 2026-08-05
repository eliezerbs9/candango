/**
 * Email-template variables + the configurable email signature.
 *
 * Templates use `{{key}}` placeholders in the subject/body; `renderTemplate` resolves them
 * against a deal's contact/company/deal/sender/workspace context. The signature is a separate,
 * per-workspace configurable block (see SignatureConfig) appended below the body at send time.
 * Shared by the template settings UI, the send flow, and (later) email automations — keep this
 * the single source of truth.
 */

/**
 * A template's scope decides which variable context it renders against — and therefore where it
 * can be used. This is the shared contract that stops an automation (or a send modal) from ever
 * pairing a template with a context it can't fill:
 *  - `deal`      — sent in the context of one deal: contact, company, deal AND the sending user
 *                  (sender.*). Used by the deal send modal and deal-triggered automations.
 *  - `marketing` — broadcast to an audience of contacts from the workspace (no single deal, no
 *                  personal sender): contact, company, workspace only. Used by marketing automations.
 */
export type TemplateScope = 'deal' | 'marketing' | 'proposal' | 'signature';
export const TEMPLATE_SCOPES: TemplateScope[] = ['deal', 'marketing', 'proposal', 'signature'];

export interface TemplateVariable {
  key: string;
  label: string;
  group: string;
  example: string;
  /**
   * Scopes this variable is available in (a deal-only var can't appear in a marketing template).
   * Optional because the signature palette (SIGNATURE_VARIABLES) reuses this shape without scoping.
   */
  scopes?: TemplateScope[];
}

// BOTH = available in every scope (contact/company/workspace/date). DEAL_ONLY = scopes that carry a
// deal + sender context (deal + proposal, never marketing). PROPOSAL = proposal-only variables.
const BOTH: TemplateScope[] = ['deal', 'marketing', 'proposal', 'signature'];
const DEAL_ONLY: TemplateScope[] = ['deal', 'proposal', 'signature'];
const PROPOSAL: TemplateScope[] = ['proposal'];
const SIGNATURE: TemplateScope[] = ['signature'];

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'contact.first_name', label: 'Contact first name', group: 'Contact', example: 'John', scopes: BOTH },
  { key: 'contact.last_name', label: 'Contact last name', group: 'Contact', example: 'Doe', scopes: BOTH },
  { key: 'contact.name', label: 'Contact full name', group: 'Contact', example: 'John Doe', scopes: BOTH },
  { key: 'contact.email', label: 'Contact email', group: 'Contact', example: 'john.doe@example.com', scopes: BOTH },
  { key: 'contact.phone', label: 'Contact phone', group: 'Contact', example: '(555) 010-1234', scopes: BOTH },
  { key: 'company.name', label: 'Company name', group: 'Company', example: 'Example Co.', scopes: BOTH },
  { key: 'deal.title', label: 'Deal title', group: 'Deal', example: 'your project', scopes: DEAL_ONLY },
  { key: 'deal.value', label: 'Deal value', group: 'Deal', example: '$5,000.00', scopes: DEAL_ONLY },
  { key: 'sender.name', label: 'Your name', group: 'Sender', example: 'Jane Doe', scopes: DEAL_ONLY },
  { key: 'sender.first_name', label: 'Your first name', group: 'Sender', example: 'Jane', scopes: DEAL_ONLY },
  { key: 'sender.last_name', label: 'Your last name', group: 'Sender', example: 'Doe', scopes: DEAL_ONLY },
  { key: 'sender.email', label: 'Your email', group: 'Sender', example: 'jane.doe@example.com', scopes: DEAL_ONLY },
  { key: 'sender.phone', label: 'Your phone', group: 'Sender', example: '(555) 987-6543', scopes: DEAL_ONLY },
  // Signature signers — the person filling each signing role (chosen at send time).
  { key: 'customer.name', label: 'Customer full name', group: 'Customer', example: 'John Doe', scopes: SIGNATURE },
  { key: 'customer.first_name', label: 'Customer first name', group: 'Customer', example: 'John', scopes: SIGNATURE },
  { key: 'customer.last_name', label: 'Customer last name', group: 'Customer', example: 'Doe', scopes: SIGNATURE },
  { key: 'customer.email', label: 'Customer email', group: 'Customer', example: 'john.doe@example.com', scopes: SIGNATURE },
  { key: 'customer.phone', label: 'Customer phone', group: 'Customer', example: '(555) 010-1234', scopes: SIGNATURE },
  { key: 'customer.title', label: 'Customer title', group: 'Customer', example: 'Procurement Manager', scopes: SIGNATURE },
  { key: 'workspace.name', label: 'Workspace name', group: 'Workspace', example: 'Your Company', scopes: BOTH },
  { key: 'date.today', label: "Today's date", group: 'Date', example: '08/03/2026', scopes: BOTH },
  { key: 'proposal.url', label: 'Proposal link', group: 'Proposal', example: 'View your proposal', scopes: PROPOSAL },
  { key: 'proposal.name', label: 'Proposal name', group: 'Proposal', example: 'Kitchen remodel proposal', scopes: PROPOSAL },
  { key: 'signature.url', label: 'Signing link', group: 'Signature', example: 'Review & sign', scopes: SIGNATURE },
  { key: 'signature.name', label: 'Document name', group: 'Signature', example: 'Service Agreement', scopes: SIGNATURE },
];

const VALID_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

/** Every known template variable key (across all scopes) — used to tell a real var from a typo. */
export const ALL_TEMPLATE_KEYS: ReadonlySet<string> = VALID_KEYS;

/** Variables available in a given scope (used to populate the editor palette + validate a body). */
export function variablesForScope(scope: TemplateScope): TemplateVariable[] {
  return TEMPLATE_VARIABLES.filter((v) => v.scopes?.includes(scope));
}

/** Keys a template of this scope is allowed to reference. */
export function allowedKeysForScope(scope: TemplateScope): Set<string> {
  return new Set(variablesForScope(scope).map((v) => v.key));
}

// ── Signature ────────────────────────────────────────────────────────────────
// A per-workspace signature (Organization.emailSignature, stored as an HTML string with
// {{variables}}) appended below every template body. Edited in the SAME rich-text editor as
// the body, but only sender/company variables are offered — never deal/contact. The image
// variables render as <img> at send/preview time (they stay as `{{...}}` text in the editor,
// since tiptap StarterKit has no image node). Mirror the renderer in apps/web/lib/email-signature.ts.

/** Variables offered when editing the signature (sender + company only). */
export const SIGNATURE_VARIABLES: TemplateVariable[] = [
  { key: 'sender.name', label: 'Full name', group: 'You', example: 'Jane Doe' },
  { key: 'sender.first_name', label: 'First name', group: 'You', example: 'Jane' },
  { key: 'sender.last_name', label: 'Last name', group: 'You', example: 'Doe' },
  { key: 'sender.email', label: 'Email', group: 'You', example: 'jane.doe@example.com' },
  { key: 'sender.phone', label: 'Phone', group: 'You', example: '(555) 987-6543' },
  { key: 'sender.photo_70', label: 'Photo 70px', group: 'Photo', example: '' },
  { key: 'sender.photo_100', label: 'Photo 100px', group: 'Photo', example: '' },
  { key: 'sender.photo_130', label: 'Photo 130px', group: 'Photo', example: '' },
  { key: 'workspace.name', label: 'Company name', group: 'Company', example: 'Your Company' },
  { key: 'workspace.logo_wide_sm', label: 'Logo landscape (S)', group: 'Logo', example: '' },
  { key: 'workspace.logo_wide_lg', label: 'Logo landscape (L)', group: 'Logo', example: '' },
  { key: 'workspace.logo_square_sm', label: 'Logo square (S)', group: 'Logo', example: '' },
  { key: 'workspace.logo_square_lg', label: 'Logo square (L)', group: 'Logo', example: '' },
];

/**
 * Keys that render as an image, with their inline attributes. Landscape logos constrain height
 * (width auto), square logos are boxed with object-fit contain, photos are round-cropped.
 * Mirror apps/web/lib/email-signature.ts.
 */
const SIGNATURE_IMAGE_ATTRS: Record<string, string> = {
  // Legacy keys (kept so old signatures still render):
  'sender.avatar_url': 'width="48" height="48" style="border-radius:24px;object-fit:cover;vertical-align:middle"',
  'workspace.logo_url': 'style="max-height:40px"',
  // Profile photo sizes:
  'sender.photo_70': 'width="70" height="70" style="border-radius:35px;object-fit:cover;vertical-align:middle"',
  'sender.photo_100': 'width="100" height="100" style="border-radius:50px;object-fit:cover;vertical-align:middle"',
  'sender.photo_130': 'width="130" height="130" style="border-radius:65px;object-fit:cover;vertical-align:middle"',
  // Logo variants:
  'workspace.logo_wide_sm': 'style="max-height:40px;max-width:200px;object-fit:contain;vertical-align:middle"',
  'workspace.logo_wide_lg': 'style="max-height:64px;max-width:280px;object-fit:contain;vertical-align:middle"',
  'workspace.logo_square_sm': 'width="64" height="64" style="object-fit:contain;vertical-align:middle"',
  'workspace.logo_square_lg': 'width="110" height="110" style="object-fit:contain;vertical-align:middle"',
};

/** Default signature body: Profile photo → Full name → Email → Phone → Company name → Company logo. */
export const DEFAULT_SIGNATURE_HTML =
  '<p>{{sender.photo_100}}</p>' +
  '<p><strong>{{sender.name}}</strong><br />{{sender.email}} · {{sender.phone}}<br />{{workspace.name}}</p>' +
  '<p>{{workspace.logo_wide_sm}}</p>';

/** A string (even empty) is the user's signature; anything else (null/undefined) → the default. */
export function normalizeSignature(input: unknown): string {
  return typeof input === 'string' ? input : DEFAULT_SIGNATURE_HTML;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SignatureSender {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

/** Build the `{{key}} → value` map for signature rendering (first/last split from the full name). */
export function buildSignatureValues(
  sender: SignatureSender,
  workspace: { name?: string | null; logoUrl?: string | null },
): Record<string, string> {
  const full = (sender.name ?? '').trim();
  const parts = full ? full.split(/\s+/) : [];
  const avatar = sender.avatarUrl ?? '';
  const logo = workspace.logoUrl ?? '';
  return {
    'sender.name': full,
    'sender.first_name': parts[0] ?? '',
    'sender.last_name': parts.slice(1).join(' '),
    'sender.email': sender.email ?? '',
    'sender.phone': sender.phone ?? '',
    // Every photo/logo size resolves to the same source URL — only the <img> sizing differs.
    'sender.avatar_url': avatar,
    'sender.photo_70': avatar,
    'sender.photo_100': avatar,
    'sender.photo_130': avatar,
    'workspace.name': workspace.name ?? '',
    'workspace.logo_url': logo,
    'workspace.logo_wide_sm': logo,
    'workspace.logo_wide_lg': logo,
    'workspace.logo_square_sm': logo,
    'workspace.logo_square_lg': logo,
  };
}

/**
 * Resolve a signature HTML string: replace `{{key}}` with values, wrapping the image keys in
 * `<img>` and dropping any variable whose value is empty (so a missing photo/logo leaves no gap).
 */
export function renderSignatureHtml(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = values[key] ?? '';
    if (!v) return '';
    if (SIGNATURE_IMAGE_ATTRS[key]) return `<img src="${escapeHtml(v)}" alt="" ${SIGNATURE_IMAGE_ATTRS[key]} />`;
    return escapeHtml(v);
  });
}

// ── Starter templates ────────────────────────────────────────────────────────
export interface DefaultTemplate {
  name: string;
  subject: string;
  body: string;
  /** Defaults to 'deal'. */
  scope?: TemplateScope;
  /**
   * Set for built-in templates that back a system function (Send estimate / Send invoice). These
   * are always seeded and can be edited but never deleted, so those flows always have a template.
   */
  systemKey?: string;
}

/**
 * Starter templates seeded for a new workspace (and available on demand for existing ones).
 * Bodies hold the message text only — the signature is appended automatically at send/preview time.
 * The `systemKey` ones are protected (non-deletable); the rest are ordinary starters.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    systemKey: 'send_estimate',
    scope: 'deal',
    name: 'Send estimate',
    subject: 'Your estimate from {{workspace.name}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Thank you for the opportunity. Please find attached your estimate for ' +
      '<strong>{{deal.title}}</strong>. Let me know if you have any questions or would like to adjust anything.</p>' +
      '<p>We look forward to working with you.</p>',
  },
  {
    systemKey: 'send_invoice',
    scope: 'deal',
    name: 'Send invoice',
    subject: 'Invoice for {{deal.title}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Please find attached the invoice for <strong>{{deal.title}}</strong> ({{deal.value}}). ' +
      'Payment details are on the invoice — just reply here if anything is unclear.</p>' +
      '<p>Thank you for your business!</p>',
  },
  {
    systemKey: 'send_proposal',
    scope: 'proposal',
    name: 'Send proposal',
    subject: 'Your proposal is ready!',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Your proposal <strong>{{proposal.name}}</strong> for {{deal.title}} is ready — {{proposal.url}}.</p>' +
      '<p>Please take a look and let us know what you think.</p>',
  },
  {
    systemKey: 'send_signature',
    scope: 'signature',
    name: 'Signature request',
    subject: 'Please sign: {{signature.name}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Please review and sign <strong>{{signature.name}}</strong> — {{signature.url}}.</p>' +
      '<p>Let me know if you have any questions.</p>',
  },
  {
    scope: 'deal',
    name: 'Follow-up',
    subject: 'Following up on {{deal.title}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>I wanted to follow up on <strong>{{deal.title}}</strong>. Do you have any questions, or is there ' +
      'anything I can help with to move things forward?</p>' +
      '<p>Happy to hop on a quick call whenever works for you.</p>',
  },
];

/** The protected system templates (subset of DEFAULT_TEMPLATES). */
export const SYSTEM_TEMPLATES = DEFAULT_TEMPLATES.filter((t) => t.systemKey);

// ── Body variable rendering ──────────────────────────────────────────────────
type JsonContact = { value?: string; label?: string };

export interface TemplateContextSources {
  person?: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    emails?: unknown; // Json [{ value, label }]
    phones?: unknown; // Json [{ value, label }]
  } | null;
  company?: { name?: string | null } | null;
  deal?: { title?: string | null; value?: number | null; currency?: string | null } | null;
  sender?: { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null;
  workspace?: { name?: string | null; timezone?: string | null } | null;
  /** The signature "customer" signer — the person filling the customer role (+ their role at the company). */
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    emails?: unknown;
    phones?: unknown;
    title?: string | null;
  } | null;
}

/** Today's date as MM/DD/YYYY in the given IANA timezone (falls back to the server's zone). */
function formatToday(timezone?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());
  }
}

function firstJsonValue(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return '';
  const first = v[0];
  // Persons store emails/phones as a plain string array (["a@b.com"]); some sources use
  // the richer [{ value, label }] shape. Support both.
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object' && typeof (first as JsonContact).value === 'string') {
    return (first as JsonContact).value ?? '';
  }
  return '';
}

function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  const amount = (minor ?? 0) / 100;
  try {
    return amount.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD' });
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Build the flat `{{key}} → value` map used by `renderTemplate` from resolved deal data. */
export function buildTemplateContext(src: TemplateContextSources): Record<string, string> {
  const p = src.person ?? {};
  const s = src.sender ?? {};
  const senderName = s.name ?? [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
  const senderParts = senderName.split(/\s+/).filter(Boolean);
  const c = src.customer ?? {};
  return {
    'contact.first_name': p.firstName ?? '',
    'contact.last_name': p.lastName ?? '',
    'contact.name': p.name ?? [p.firstName, p.lastName].filter(Boolean).join(' ').trim(),
    'contact.email': firstJsonValue(p.emails),
    'contact.phone': firstJsonValue(p.phones),
    'company.name': src.company?.name ?? '',
    'deal.title': src.deal?.title ?? '',
    'deal.value': formatMoney(src.deal?.value, src.deal?.currency),
    'sender.name': senderName,
    'sender.first_name': s.firstName ?? senderParts[0] ?? '',
    'sender.last_name': s.lastName ?? senderParts.slice(1).join(' '),
    'sender.email': s.email ?? '',
    'sender.phone': s.phone ?? '',
    // Signature signers — the people filling each signing role (chosen at send).
    'customer.first_name': c.firstName ?? '',
    'customer.last_name': c.lastName ?? '',
    'customer.name': c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim(),
    'customer.email': firstJsonValue(c.emails),
    'customer.phone': firstJsonValue(c.phones),
    'customer.title': c.title ?? '',
    'workspace.name': src.workspace?.name ?? '',
    'date.today': formatToday(src.workspace?.timezone),
  };
}

/**
 * Replace `{{key}}` placeholders in `text` with values from `ctx`. Unknown keys and
 * missing values collapse to an empty string so partial context never leaks `{{...}}`.
 */
export function renderTemplate(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (!VALID_KEYS.has(key)) return '';
    return ctx[key] ?? '';
  });
}
