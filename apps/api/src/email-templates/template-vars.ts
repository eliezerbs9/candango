/**
 * Email-template variables + the configurable email signature.
 *
 * Templates use `{{key}}` placeholders in the subject/body; `renderTemplate` resolves them
 * against a deal's contact/company/deal/sender/workspace context. The signature is a separate,
 * per-workspace configurable block (see SignatureConfig) appended below the body at send time.
 * Shared by the template settings UI, the send flow, and (later) email automations — keep this
 * the single source of truth.
 */

export interface TemplateVariable {
  key: string;
  label: string;
  group: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'contact.first_name', label: 'Contact first name', group: 'Contact', example: 'Alex' },
  { key: 'contact.last_name', label: 'Contact last name', group: 'Contact', example: 'Taylor' },
  { key: 'contact.name', label: 'Contact full name', group: 'Contact', example: 'Alex Taylor' },
  { key: 'contact.email', label: 'Contact email', group: 'Contact', example: 'alex@example.com' },
  { key: 'contact.phone', label: 'Contact phone', group: 'Contact', example: '(555) 123-4567' },
  { key: 'company.name', label: 'Company name', group: 'Company', example: 'Acme Inc.' },
  { key: 'deal.title', label: 'Deal title', group: 'Deal', example: 'your project' },
  { key: 'deal.value', label: 'Deal value', group: 'Deal', example: '$5,000.00' },
  { key: 'sender.name', label: 'Your name', group: 'Sender', example: 'Jordan Lee' },
  { key: 'sender.email', label: 'Your email', group: 'Sender', example: 'jordan@example.com' },
  { key: 'sender.phone', label: 'Your phone', group: 'Sender', example: '(555) 987-6543' },
  { key: 'workspace.name', label: 'Workspace name', group: 'Workspace', example: 'Your Company' },
];

const VALID_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

// ── Signature ────────────────────────────────────────────────────────────────
// A per-workspace signature (Organization.emailSignature, stored as an HTML string with
// {{variables}}) appended below every template body. Edited in the SAME rich-text editor as
// the body, but only sender/company variables are offered — never deal/contact. The image
// variables render as <img> at send/preview time (they stay as `{{...}}` text in the editor,
// since tiptap StarterKit has no image node). Mirror the renderer in apps/web/lib/email-signature.ts.

/** Variables offered when editing the signature (sender + company only). */
export const SIGNATURE_VARIABLES: TemplateVariable[] = [
  { key: 'sender.name', label: 'Full name', group: 'You', example: 'Jordan Lee' },
  { key: 'sender.first_name', label: 'First name', group: 'You', example: 'Jordan' },
  { key: 'sender.last_name', label: 'Last name', group: 'You', example: 'Lee' },
  { key: 'sender.email', label: 'Email', group: 'You', example: 'jordan@example.com' },
  { key: 'sender.phone', label: 'Phone', group: 'You', example: '(555) 987-6543' },
  { key: 'sender.avatar_url', label: 'Profile photo', group: 'You', example: '' },
  { key: 'workspace.name', label: 'Company name', group: 'Company', example: 'Your Company' },
  { key: 'workspace.logo_url', label: 'Company logo', group: 'Company', example: '' },
];

/** Keys that render as an image, with their inline attributes. */
const SIGNATURE_IMAGE_ATTRS: Record<string, string> = {
  'sender.avatar_url': 'width="48" height="48" style="border-radius:24px;vertical-align:middle"',
  'workspace.logo_url': 'style="max-height:40px"',
};

/** Default signature body: Profile photo → Full name → Email → Phone → Company name → Company logo. */
export const DEFAULT_SIGNATURE_HTML =
  '<p>{{sender.avatar_url}}</p>' +
  '<p><strong>{{sender.name}}</strong><br />{{sender.email}} · {{sender.phone}}<br />{{workspace.name}}</p>' +
  '<p>{{workspace.logo_url}}</p>';

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
  return {
    'sender.name': full,
    'sender.first_name': parts[0] ?? '',
    'sender.last_name': parts.slice(1).join(' '),
    'sender.email': sender.email ?? '',
    'sender.phone': sender.phone ?? '',
    'sender.avatar_url': sender.avatarUrl ?? '',
    'workspace.name': workspace.name ?? '',
    'workspace.logo_url': workspace.logoUrl ?? '',
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
}

/**
 * Starter templates seeded for a new workspace (and available on demand for existing ones).
 * Bodies hold the message text only — the signature is appended automatically at send/preview time.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Send estimate',
    subject: 'Your estimate from {{workspace.name}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Thank you for the opportunity. Please find attached your estimate for ' +
      '<strong>{{deal.title}}</strong>. Let me know if you have any questions or would like to adjust anything.</p>' +
      '<p>We look forward to working with you.</p>',
  },
  {
    name: 'Send invoice',
    subject: 'Invoice for {{deal.title}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>Please find attached the invoice for <strong>{{deal.title}}</strong> ({{deal.value}}). ' +
      'Payment details are on the invoice — just reply here if anything is unclear.</p>' +
      '<p>Thank you for your business!</p>',
  },
  {
    name: 'Follow-up',
    subject: 'Following up on {{deal.title}}',
    body:
      '<p>Hi {{contact.first_name}},</p>' +
      '<p>I wanted to follow up on <strong>{{deal.title}}</strong>. Do you have any questions, or is there ' +
      'anything I can help with to move things forward?</p>' +
      '<p>Happy to hop on a quick call whenever works for you.</p>',
  },
];

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
  sender?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  workspace?: { name?: string | null } | null;
}

function firstJsonValue(v: unknown): string {
  if (Array.isArray(v)) {
    const first = v[0] as JsonContact | undefined;
    return first?.value ?? '';
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
  return {
    'contact.first_name': p.firstName ?? '',
    'contact.last_name': p.lastName ?? '',
    'contact.name': p.name ?? [p.firstName, p.lastName].filter(Boolean).join(' ').trim(),
    'contact.email': firstJsonValue(p.emails),
    'contact.phone': firstJsonValue(p.phones),
    'company.name': src.company?.name ?? '',
    'deal.title': src.deal?.title ?? '',
    'deal.value': formatMoney(src.deal?.value, src.deal?.currency),
    'sender.name': src.sender?.name ?? '',
    'sender.email': src.sender?.email ?? '',
    'sender.phone': src.sender?.phone ?? '',
    'workspace.name': src.workspace?.name ?? '',
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
