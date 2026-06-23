import { google, type calendar_v3 } from 'googleapis';
import { decryptToken } from './crypto.util';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** A Google Calendar client authed as the connection's user (auto-refreshes via the refresh token). */
export function calendarFor(conn: TokenPair): calendar_v3.Calendar {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    refresh_token: conn.refreshToken ? decryptToken(conn.refreshToken) : undefined,
    access_token: conn.accessToken ? decryptToken(conn.accessToken) : undefined,
  });
  return google.calendar({ version: 'v3', auth: oauth2 });
}
