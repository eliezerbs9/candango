import { google, type calendar_v3, type gmail_v1, type tasks_v1 } from 'googleapis';
import { decryptToken } from './crypto.util';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** OAuth2 client authed as the connection's user (auto-refreshes via the refresh token). */
function oauthFor(conn: TokenPair) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    refresh_token: conn.refreshToken ? decryptToken(conn.refreshToken) : undefined,
    access_token: conn.accessToken ? decryptToken(conn.accessToken) : undefined,
  });
  return oauth2;
}

export function calendarFor(conn: TokenPair): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth: oauthFor(conn) });
}

export function tasksFor(conn: TokenPair): tasks_v1.Tasks {
  return google.tasks({ version: 'v1', auth: oauthFor(conn) });
}

export function gmailFor(conn: TokenPair): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: oauthFor(conn) });
}
