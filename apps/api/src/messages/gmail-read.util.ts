import { google, type gmail_v1 } from 'googleapis';
import { decryptToken } from '../integrations/crypto.util';

/** A Gmail client authed as the connection's user (for on-demand body reads). */
export function gmailClientFor(conn: { accessToken: string; refreshToken: string }): gmail_v1.Gmail {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    refresh_token: conn.refreshToken ? decryptToken(conn.refreshToken) : undefined,
    access_token: conn.accessToken ? decryptToken(conn.accessToken) : undefined,
  });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

const decode = (data?: string | null) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '');

/** Walk the MIME tree, collecting plain-text and HTML bodies. */
export function extractBody(payload?: gmail_v1.Schema$MessagePart): { text: string; html: string } {
  let text = '';
  let html = '';
  const walk = (part?: gmail_v1.Schema$MessagePart) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) text += decode(part.body.data);
    else if (part.mimeType === 'text/html' && part.body?.data) html += decode(part.body.data);
    (part.parts ?? []).forEach(walk);
  };
  walk(payload);
  return { text, html };
}
