/**
 * Email-template variables. Templates use `{{key}}` placeholders in the subject/body;
 * `renderTemplate` resolves them against a deal's contact/company/deal/sender/workspace
 * context. Shared by the template settings UI (via GET /email-templates/variables),
 * the send flow, and (later) email automations — keep this the single source of truth.
 */

export interface TemplateVariable {
  /** Placeholder key used as `{{key}}`. */
  key: string;
  /** Human label for the palette. */
  label: string;
  /** Grouping for the palette (Contact, Company, Deal, Sender, Workspace). */
  group: string;
  /** Example value shown in the preview. */
  example: string;
  /** When true, the key is valid for rendering but hidden from the click-to-insert palette
   *  (e.g. a URL that only makes sense inside an <img>, not as body text). */
  hidden?: boolean;
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
  // Image URLs — only meaningful inside the signature's <img>; not text badges.
  { key: 'sender.avatar_url', label: 'Your profile photo URL', group: 'Sender', example: '', hidden: true },
  { key: 'workspace.logo_url', label: 'Workspace logo URL', group: 'Workspace', example: '', hidden: true },
];

const VALID_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

/**
 * A ready-made HTML signature (uses sender + workspace variables) appended below the body
 * when a template is sent/previewed. Kept OUT of the editable body because the shared
 * rich-text editor (tiptap StarterKit) has no image node and would strip the <img> tags.
 * `renderSignature` resolves it and drops any image whose URL is empty.
 * NOTE: mirror any change in apps/web/lib/email-signature.ts (the preview copy).
 */
export const SIGNATURE_HTML =
  '<p>—</p>' +
  '<p>' +
  '<img src="{{sender.avatar_url}}" alt="{{sender.name}}" width="48" height="48" ' +
  'style="border-radius:24px;vertical-align:middle;margin-right:10px" />' +
  '<strong>{{sender.name}}</strong><br />' +
  '{{sender.email}} · {{sender.phone}}<br />' +
  '{{workspace.name}}' +
  '</p>' +
  '<p><img src="{{workspace.logo_url}}" alt="{{workspace.name}}" style="max-height:40px" /></p>';

/** Resolve the signature and remove any <img> left with an empty src (no avatar/logo set). */
export function renderSignature(ctx: Record<string, string>): string {
  return renderTemplate(SIGNATURE_HTML, ctx).replace(/<img[^>]*\ssrc=""[^>]*>/gi, '');
}

export interface DefaultTemplate {
  name: string;
  subject: string;
  body: string;
}

/**
 * Starter templates seeded for a new workspace (and available on demand for existing ones).
 * Bodies hold the message text only — the signature (with the sender's photo + phone and the
 * workspace logo) is appended automatically at send/preview time (see SIGNATURE_HTML).
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
  sender?: { name?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null } | null;
  workspace?: { name?: string | null; logoUrl?: string | null } | null;
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
    'sender.avatar_url': src.sender?.avatarUrl ?? '',
    'workspace.name': src.workspace?.name ?? '',
    'workspace.logo_url': src.workspace?.logoUrl ?? '',
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
