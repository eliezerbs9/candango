import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from './crypto.util';

/**
 * One consent grants Calendar, Tasks, and Gmail send. All scopes are **sensitive** (no CASA):
 * the restricted `gmail.modify`/`gmail.readonly` (full inbox read) is intentionally NOT requested —
 * email is captured via BCC / inbound-parse + Reply-To. Full inbox sync is deferred to CASA.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
];

/** Pull the verified email out of Google's id_token (no read scope needed). */
function emailFromIdToken(idToken?: string | null): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()) as {
      email?: string;
    };
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

interface StatePayload {
  sub: string;
  orgId: string;
  kind: string;
}

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectQueue('gmail-sync') private readonly gmailQueue: Queue,
    @InjectQueue('calendar-sync') private readonly calendarQueue: Queue,
  ) {}

  /** Kick off a Gmail capture for the user (on connect or on demand). */
  syncEmail(userId: string) {
    return this.gmailQueue.add('sync-user', { userId }, { removeOnComplete: 200, removeOnFail: 500 });
  }

  /** On connect: pull Google events in now, and push up any activities created while disconnected. */
  private async backfillCalendar(orgId: string, userId: string) {
    await this.calendarQueue.add('pull-user', { userId }, { removeOnComplete: true, removeOnFail: 200 });
    const unsynced = await this.prisma.activity.findMany({
      where: { orgId, assignedUserId: userId, calendarEventId: null, googleTaskId: null },
      select: { id: true },
    });
    for (const a of unsynced) {
      await this.calendarQueue.add('sync', { op: 'upsert', activityId: a.id }, { removeOnComplete: true, removeOnFail: 200 });
    }
  }

  private oauthClient() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      'http://localhost:4000/v1/integrations/google/callback';
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /** Build the Google consent URL; the signed `state` carries the user identity through the redirect. */
  async authUrl(userId: string, orgId: string): Promise<string> {
    const state = await this.jwt.signAsync(
      { sub: userId, orgId, kind: 'google_oauth' },
      { expiresIn: '10m' },
    );
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token on every consent
      include_granted_scopes: true,
      scope: SCOPES,
      state,
    });
  }

  /** Exchange the auth code for tokens and store the (encrypted) connection. Returns the org for redirects. */
  async handleCallback(code: string, state: string): Promise<{ orgId: string }> {
    let payload: StatePayload;
    try {
      payload = await this.jwt.verifyAsync<StatePayload>(state);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (payload.kind !== 'google_oauth') throw new BadRequestException('Invalid OAuth state');
    const { sub: userId, orgId } = payload;

    const { tokens } = await this.oauthClient().getToken(code);
    if (!tokens.access_token) throw new BadRequestException('Google did not return an access token');

    const access = encryptToken(tokens.access_token);
    const refresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    const connectedEmail = emailFromIdToken(tokens.id_token); // the From for sends (no read scope needed)

    await this.prisma.calendarConnection.upsert({
      where: { userId },
      create: {
        orgId,
        userId,
        provider: 'google',
        accessToken: access,
        refreshToken: refresh ?? '',
        tokenExpiry: expiry,
        status: 'connected',
      },
      update: {
        accessToken: access,
        ...(refresh ? { refreshToken: refresh } : {}),
        tokenExpiry: expiry,
        status: 'connected',
      },
    });

    await this.prisma.mailboxConnection.upsert({
      where: { userId },
      create: {
        orgId,
        userId,
        provider: 'gmail',
        accessToken: access,
        refreshToken: refresh ?? '',
        ...(connectedEmail ? { email: connectedEmail } : {}),
        status: 'connected',
      },
      update: {
        accessToken: access,
        ...(refresh ? { refreshToken: refresh } : {}),
        ...(connectedEmail ? { email: connectedEmail } : {}),
        status: 'connected',
      },
    });

    // Full Gmail inbox sync is disabled (no-CASA launch) — no email backfill on connect.
    // Email capture is via BCC / inbound-parse + Reply-To. See [[Email & Messaging Sync]].
    await this.backfillCalendar(orgId, userId); // pull events in + push existing activities up
    return { orgId };
  }

  /** Connection status for the current user (no tokens exposed). */
  async status(userId: string) {
    const [calendar, mailbox] = await Promise.all([
      this.prisma.calendarConnection.findUnique({
        where: { userId },
        select: { status: true, updatedAt: true },
      }),
      this.prisma.mailboxConnection.findUnique({
        where: { userId },
        select: { status: true, updatedAt: true },
      }),
    ]);
    return { connected: Boolean(calendar || mailbox), calendar, mailbox };
  }

  /** Calendar + Tasks clients authed as the connection's user (for cleanup on disconnect). */
  private googleClientsFor(conn: { accessToken: string; refreshToken: string }) {
    const oauth = this.oauthClient();
    oauth.setCredentials({
      access_token: conn.accessToken ? decryptToken(conn.accessToken) : undefined,
      refresh_token: conn.refreshToken ? decryptToken(conn.refreshToken) : undefined,
    });
    return { calendar: google.calendar({ version: 'v3', auth: oauth }), tasks: google.tasks({ version: 'v1', auth: oauth }) };
  }

  /**
   * Disconnect = undo the sync both ways:
   *  - Candango-created Google events/tasks are DELETED from Google.
   *  - Google-imported events are DELETED from Candango (the user's real events stay in Google).
   *  - The user's own activities survive in the CRM, just unlinked.
   */
  async disconnect(userId: string) {
    const conn = await this.prisma.calendarConnection.findUnique({ where: { userId } });

    // 1) Best-effort: delete the events/tasks Candango pushed, from Google (while the token is still valid).
    if (conn?.refreshToken) {
      const { calendar, tasks } = this.googleClientsFor(conn);
      const outbound = await this.prisma.activity.findMany({
        where: { assignedUserId: userId, calendarEvent: { syncDirection: 'outbound' } },
        select: { calendarEvent: { select: { externalEventId: true } } },
      });
      for (const a of outbound) {
        const eid = a.calendarEvent?.externalEventId;
        if (eid) await calendar.events.delete({ calendarId: 'primary', eventId: eid, sendUpdates: 'none' }).catch(() => undefined);
      }
      const taskActs = await this.prisma.activity.findMany({
        where: { assignedUserId: userId, googleTaskId: { not: null } },
        select: { googleTaskId: true },
      });
      for (const a of taskActs) {
        if (a.googleTaskId) await tasks.tasks.delete({ tasklist: '@default', task: a.googleTaskId }).catch(() => undefined);
      }
    }

    // 2) Remove the connections.
    await this.prisma.calendarConnection.deleteMany({ where: { userId } });
    await this.prisma.mailboxConnection.deleteMany({ where: { userId } });

    // 3) Clean synced Gmail data — every Message row is Gmail-originated.
    await this.prisma.message.deleteMany({ where: { userId } });

    // 4) Calendar: drop Google-IMPORTED activities; keep the user's own (just unlink them).
    const linked = await this.prisma.activity.findMany({
      where: { assignedUserId: userId, calendarEventId: { not: null } },
      select: { id: true, calendarEvent: { select: { id: true, syncDirection: true } } },
    });
    const eventIds = linked.map((a) => a.calendarEvent?.id).filter((x): x is string => !!x);
    const importedActivityIds = linked
      .filter((a) => a.calendarEvent?.syncDirection === 'inbound')
      .map((a) => a.id);
    if (eventIds.length) await this.prisma.calendarEvent.deleteMany({ where: { id: { in: eventIds } } });
    if (importedActivityIds.length) {
      await this.prisma.activity.deleteMany({ where: { id: { in: importedActivityIds } } });
    }
    // Unlink the user's own (outbound-synced) activities so they survive as plain activities.
    await this.prisma.activity.updateMany({
      where: { assignedUserId: userId, OR: [{ calendarEventId: { not: null } }, { googleTaskId: { not: null } }] },
      data: { calendarEventId: null, googleTaskId: null },
    });
  }
}
