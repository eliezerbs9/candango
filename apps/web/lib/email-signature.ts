/**
 * HTML signature appended below a template body (sender photo + name/email/phone + workspace
 * logo). Kept OUT of the editable rich-text body because the shared tiptap editor has no image
 * node and would strip the <img> tags. Mirror of apps/api/src/email-templates/template-vars.ts
 * (SIGNATURE_HTML) — keep the two in sync.
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

/** Replace `{{key}}` from `values`, then drop any <img> whose src ended up empty. */
export function renderWithVars(html: string, values: Record<string, string>): string {
  return html
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => values[k] ?? '')
    .replace(/<img[^>]*\ssrc=""[^>]*>/gi, '');
}
