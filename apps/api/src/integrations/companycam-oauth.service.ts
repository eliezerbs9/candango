import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from './crypto.util';

const AUTHORIZE_URL = 'https://app.companycam.com/oauth/authorize';
export const TOKEN_URL = 'https://app.companycam.com/oauth/token';

/** `write` is needed to create a project from a deal; `destroy` is deliberately NOT requested. */
const SCOPES = 'read write';

interface StatePayload {
  sub: string;
  orgId: string;
  kind: string;
}

/** Carries the HTTP status so callers can tell "re-auth needed" (400/401) from a transient failure. */
export class CompanyCamTokenError extends BadRequestException {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export interface CompanyCamTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

/**
 * CompanyCam OAuth — one connection per workspace, tokens stored encrypted in
 * `CompanyCamConnection`. Mirrors the QuickBooks flow (signed JWT `state` carries the org through
 * the redirect), with one important difference: CompanyCam access tokens expire in ~2 hours and
 * **the refresh token is rotated on every refresh**, so both values are rewritten each time.
 */
@Injectable()
export class CompanyCamOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private creds() {
    const clientId = this.config.get<string>('COMPANYCAM_CLIENT_ID');
    const clientSecret = this.config.get<string>('COMPANYCAM_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'CompanyCam is not configured (set COMPANYCAM_CLIENT_ID / COMPANYCAM_CLIENT_SECRET)',
      );
    }
    return { clientId, clientSecret, redirectUri: this.redirectUri() };
  }

  private redirectUri() {
    return (
      this.config.get<string>('COMPANYCAM_REDIRECT_URI') ??
      'http://localhost:4000/v1/integrations/companycam/callback'
    );
  }

  get configured() {
    return !!this.config.get<string>('COMPANYCAM_CLIENT_ID') && !!this.config.get<string>('COMPANYCAM_CLIENT_SECRET');
  }

  /** Consent URL; the signed `state` carries the org + user through the redirect. */
  async authUrl(userId: string, orgId: string): Promise<string> {
    const { clientId, redirectUri } = this.creds();
    const state = await this.jwt.signAsync({ sub: userId, orgId, kind: 'companycam_oauth' }, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchange the code for tokens and store the encrypted per-org connection. */
  async handleCallback(code: string, state: string): Promise<{ orgId: string }> {
    let payload: StatePayload;
    try {
      payload = await this.jwt.verifyAsync<StatePayload>(state);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (payload.kind !== 'companycam_oauth') throw new BadRequestException('Invalid OAuth state');
    const { sub: userId, orgId } = payload;

    const t = await this.exchange({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri() });
    const data = {
      accessToken: encryptToken(t.access_token),
      refreshToken: encryptToken(t.refresh_token),
      tokenExpiry: new Date(Date.now() + (t.expires_in ?? 7200) * 1000),
      status: 'connected',
      connectedBy: userId,
      lastError: null,
    };
    await this.prisma.companyCamConnection.upsert({
      where: { orgId },
      create: { orgId, ...data },
      update: data,
    });
    return { orgId };
  }

  /** POST to the token endpoint (shared by the code exchange and every refresh). */
  async exchange(body: Record<string, string>): Promise<CompanyCamTokens> {
    const { clientId, clientSecret } = this.creds();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new CompanyCamTokenError(res.status, `CompanyCam token request failed (${res.status}): ${text.slice(0, 200)}`);
    const t = JSON.parse(text) as CompanyCamTokens;
    if (!t.access_token || !t.refresh_token) throw new BadRequestException('CompanyCam returned an incomplete token');
    return t;
  }

  async status(orgId: string) {
    const c = await this.prisma.companyCamConnection.findUnique({
      where: { orgId },
      select: { status: true, updatedAt: true, lastRefreshAt: true, lastError: true },
    });
    return {
      configured: this.configured,
      connected: c?.status === 'connected',
      status: c?.status ?? 'disconnected',
      connectedAt: c?.updatedAt ?? null,
      lastRefreshAt: c?.lastRefreshAt ?? null,
      lastError: c?.lastError ?? null,
    };
  }

  async disconnect(orgId: string) {
    await this.prisma.companyCamConnection.deleteMany({ where: { orgId } });
    return { ok: true };
  }
}
