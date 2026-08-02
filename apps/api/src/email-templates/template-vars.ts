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
  { key: 'workspace.name', label: 'Workspace name', group: 'Workspace', example: 'BSB Tech Hub' },
];

const VALID_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

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
  sender?: { name?: string | null; email?: string | null } | null;
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
