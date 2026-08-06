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
  { key: 'sender.photo_70', label: 'Photo 70px', group: 'Photo' },
  { key: 'sender.photo_100', label: 'Photo 100px', group: 'Photo' },
  { key: 'sender.photo_130', label: 'Photo 130px', group: 'Photo' },
  { key: 'workspace.name', label: 'Company name', group: 'Company' },
  { key: 'workspace.logo_wide_sm', label: 'Logo landscape (S)', group: 'Logo' },
  { key: 'workspace.logo_wide_lg', label: 'Logo landscape (L)', group: 'Logo' },
  { key: 'workspace.logo_square_sm', label: 'Logo square (S)', group: 'Logo' },
  { key: 'workspace.logo_square_lg', label: 'Logo square (L)', group: 'Logo' },
];

// Image variables render as <img>; each key carries its own sizing. Landscape logos constrain
// height (width auto), square logos are boxed with object-fit contain, photos are round-cropped.
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

/** Default signature: Profile photo → Full name → Email → Phone → Company name → Company logo. */
export const DEFAULT_SIGNATURE_HTML =
  '<p>{{sender.photo_100}}</p>' +
  '<p><strong>{{sender.name}}</strong><br />{{sender.email}} · {{sender.phone}}<br />{{workspace.name}}</p>' +
  '<p>{{workspace.logo_wide_sm}}</p>';

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

/** Resolve a signature HTML string: image keys → <img>, empty values dropped. */
export function renderSignatureHtml(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = values[key] ?? '';
    if (!v) return '';
    if (SIGNATURE_IMAGE_ATTRS[key]) return `<img src="${escapeHtml(v)}" alt="" ${SIGNATURE_IMAGE_ATTRS[key]} />`;
    return escapeHtml(v);
  });
}

/** Split a placeholder expression into its `or`-fallback keys (`a or b` → ['a','b']). */
const varKeys = (expr: string): string[] => expr.split(/\s+or\s+/i).map((k) => k.trim());

/** Replace `{{key}}` placeholders (for previewing a template body with example/real values). */
export function renderVars(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    for (const k of varKeys(expr)) if (values[k]) return values[k];
    return '';
  });
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
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const keys = varKeys(expr);
    for (const key of keys) if (realValues[key]) return escapeHtml(realValues[key]);
    const labelled = keys.find((k) => labelByKey[k]) ?? keys[0] ?? '';
    return `<span style="${CHIP_STYLE}">${escapeHtml(labelByKey[labelled] ?? labelled)}</span>`;
  });
}

/** Same as renderPreview but plain text (real value, else the label) — for non-HTML spots. */
export function renderPreviewText(
  text: string,
  realValues: Record<string, string>,
  labelByKey: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const keys = varKeys(expr);
    for (const key of keys) if (realValues[key]) return realValues[key];
    const labelled = keys.find((k) => labelByKey[k]) ?? keys[0] ?? '';
    return labelByKey[labelled] ?? labelled;
  });
}
