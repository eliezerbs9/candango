/**
 * Email signature — mirror of apps/api/src/email-templates/template-vars.ts (the signature part).
 * The signature is an HTML string with sender/company `{{variables}}`, edited in the same
 * rich-text editor as the body. Image variables render as <img> at preview/send time (they stay
 * as `{{...}}` text in the editor). Keep the renderer + variable list in sync with the API.
 */

export interface SignatureVariable {
  key: string;
  label: string;
  group: string;
}

/** Variables offered when editing the signature (sender + company only — never deal/contact). */
export const SIGNATURE_VARIABLES: SignatureVariable[] = [
  { key: 'sender.name', label: 'Full name', group: 'You' },
  { key: 'sender.first_name', label: 'First name', group: 'You' },
  { key: 'sender.last_name', label: 'Last name', group: 'You' },
  { key: 'sender.email', label: 'Email', group: 'You' },
  { key: 'sender.phone', label: 'Phone', group: 'You' },
  { key: 'sender.avatar_url', label: 'Profile photo', group: 'You' },
  { key: 'workspace.name', label: 'Company name', group: 'Company' },
  { key: 'workspace.logo_url', label: 'Company logo', group: 'Company' },
];

const SIGNATURE_IMAGE_ATTRS: Record<string, string> = {
  'sender.avatar_url': 'width="48" height="48" style="border-radius:24px;vertical-align:middle"',
  'workspace.logo_url': 'style="max-height:40px"',
};

/** Default signature: Profile photo → Full name → Email → Phone → Company name → Company logo. */
export const DEFAULT_SIGNATURE_HTML =
  '<p>{{sender.avatar_url}}</p>' +
  '<p><strong>{{sender.name}}</strong><br />{{sender.email}} · {{sender.phone}}<br />{{workspace.name}}</p>' +
  '<p>{{workspace.logo_url}}</p>';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SignatureSender {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

/** Build the `{{key}} → value` map for the signature (first/last split from the full name). */
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

/** Resolve a signature HTML string: image keys → <img>, empty values dropped. */
export function renderSignatureHtml(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = values[key] ?? '';
    if (!v) return '';
    if (SIGNATURE_IMAGE_ATTRS[key]) return `<img src="${escapeHtml(v)}" alt="" ${SIGNATURE_IMAGE_ATTRS[key]} />`;
    return escapeHtml(v);
  });
}

/** Replace `{{key}}` placeholders (for previewing a template body with example/real values). */
export function renderVars(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => values[k] ?? '');
}

const CHIP_STYLE =
  'background:var(--mantine-color-gray-2);color:var(--mantine-color-gray-7);border-radius:4px;padding:0 5px;font-size:0.9em';

/**
 * Preview a template (HTML): substitute the real sender/workspace value when we have one,
 * otherwise show the variable's **label as a placeholder chip** (e.g. "Deal Title") — never a
 * fake value, which would distort the email's meaning.
 */
export function renderPreview(
  html: string,
  realValues: Record<string, string>,
  labelByKey: Record<string, string>,
): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const real = realValues[key];
    if (real) return escapeHtml(real);
    return `<span style="${CHIP_STYLE}">${escapeHtml(labelByKey[key] ?? key)}</span>`;
  });
}

/** Same as renderPreview but plain text (real value, else the label) — for non-HTML spots. */
export function renderPreviewText(
  text: string,
  realValues: Record<string, string>,
  labelByKey: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => realValues[key] ?? labelByKey[key] ?? key);
}
