import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from './crypto.util';

/** One consent grants both Calendar and Gmail; we store a connection for each. */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/gmail.modify', // read + label changes (mark read) + trash
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
];

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
  ) {}

  /** Kick off a Gmail capture for the user (on connect or on demand). */
  syncEmail(userId: string) {
    return this.gmailQueue.add('sync-user', { userId }, { removeOnComplete: 200, removeOnFail: 500 });
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
        status: 'connected',
      },
      update: {
        accessToken: access,
        ...(refresh ? { refreshToken: refresh } : {}),
        status: 'connected',
      },
    });

    await this.syncEmail(userId); // initial Gmail backfill
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

  async disconnect(userId: string) {
    await this.prisma.calendarConnection.deleteMany({ where: { userId } });
    await this.prisma.mailboxConnection.deleteMany({ where: { userId } });
  }
}
