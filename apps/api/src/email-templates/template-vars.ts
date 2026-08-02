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
  { key: 'contact.first_name', label: 'Contact first name', group: 'Contact', example: 'Maria' },
  { key: 'contact.last_name', label: 'Contact last name', group: 'Contact', example: 'Silva' },
  { key: 'contact.name', label: 'Contact full name', group: 'Contact', example: 'Maria Silva' },
  { key: 'contact.email', label: 'Contact email', group: 'Contact', example: 'maria@example.com' },
  { key: 'contact.phone', label: 'Contact phone', group: 'Contact', example: '(555) 123-4567' },
  { key: 'company.name', label: 'Company name', group: 'Company', example: 'Silva Construction' },
  { key: 'deal.title', label: 'Deal title', group: 'Deal', example: 'Kitchen remodel' },
  { key: 'deal.value', label: 'Deal value', group: 'Deal', example: '$12,500.00' },
  { key: 'sender.name', label: 'Your name', group: 'Sender', example: 'John Carter' },
  { key: 'sender.email', label: 'Your email', group: 'Sender', example: 'john@bsbtechub.com' },
  { key: 'sender.phone', label: 'Your phone', group: 'Sender', example: '(555) 987-6543' },
  { key: 'workspace.name', label: 'Workspace name', group: 'Workspace', example: 'BSB Tech Hub' },
];

const VALID_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

// ── Signature ────────────────────────────────────────────────────────────────
// A per-workspace signature appended below every template body. Which elements appear
// is configurable (Organization.emailSignature); the sender's photo/name/email/phone and
// the workspace logo are filled in per send. Kept OUT of the rich-text body (tiptap
// StarterKit has no image node and would strip <img>). Mirror any change to the builder in
// apps/web/lib/email-signature.ts (the preview copy).

export interface SignatureConfig {
  photo: boolean;
  name: boolean;
  email: boolean;
  phone: boolean;
  logo: boolean;
  text: string;
}

/** Default: photo · name · email · phone · company logo, no extra text. */
export const DEFAULT_SIGNATURE_CONFIG: SignatureConfig = {
  photo: true,
  name: true,
  email: true,
  phone: true,
  logo: true,
  text: '',
};

/** Coerce arbitrary JSON (or null) into a valid SignatureConfig (used on read + before save). */
export function normalizeSignatureConfig(input: unknown): SignatureConfig {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    photo: bool(o.photo, true),
    name: bool(o.name, true),
    email: bool(o.email, true),
    phone: bool(o.phone, true),
    logo: bool(o.logo, true),
    text: typeof o.text === 'string' ? o.text.slice(0, 2000) : '',
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SignatureValues {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
}

/**
 * Build the signature HTML from its config + the resolved sender/workspace values. Elements
 * whose toggle is off — or whose value is empty — are skipped, so an all-off config (or a
 * workspace with no logo/avatar) yields a clean (possibly empty) block.
 */
export function buildSignatureHtml(config: SignatureConfig, v: SignatureValues): string {
  const name = (v.name ?? '').trim();
  const email = (v.email ?? '').trim();
  const phone = (v.phone ?? '').trim();
  const avatar = v.avatarUrl ?? '';
  const logo = v.logoUrl ?? '';

  const photoImg =
    config.photo && avatar
      ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" width="48" height="48" ` +
        'style="border-radius:24px;vertical-align:middle;margin-right:10px" />'
      : '';

  const lines: string[] = [];
  if (config.name && name) lines.push(`<strong>${escapeHtml(name)}</strong>`);
  const contact = [config.email ? email : '', config.phone ? phone : '']
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  if (contact) lines.push(contact);
  if (config.text.trim()) lines.push(escapeHtml(config.text.trim()).replace(/\n/g, '<br />'));

  const logoImg =
    config.logo && logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" style="max-height:40px" />` : '';

  if (!photoImg && lines.length === 0 && !logoImg) return '';

  const person = photoImg || lines.length ? `<p>${photoImg}${lines.join('<br />')}</p>` : '';
  const logoBlock = logoImg ? `<p>${logoImg}</p>` : '';
  return `<p>—</p>${person}${logoBlock}`;
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
