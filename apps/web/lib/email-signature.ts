/**
 * Configurable email signature — mirror of apps/api/src/email-templates/template-vars.ts
 * (SignatureConfig + buildSignatureHtml). Keep the two builders in sync. The signature is a
 * per-workspace config resolved with the sending user's photo/name/email/phone + workspace logo,
 * appended below every template body.
 */

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SignatureValues {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
}

/** Build the signature HTML from its config + resolved sender/workspace values. */
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

/** Replace `{{key}}` placeholders (for previewing a body with example/real values). */
export function renderVars(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => values[k] ?? '');
}
