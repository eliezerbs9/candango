import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import OAuthClient from 'intuit-oauth';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from './crypto.util';

interface StatePayload {
  sub: string;
  orgId: string;
  kind: string;
}

/** QuickBooks Online OAuth — per-org connection; tokens stored encrypted in `quickbooks_connections`. */
@Injectable()
export class QuickbooksOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private redirectUri() {
    return (
      this.config.get<string>('QBO_REDIRECT_URI') ??
      'http://localhost:4000/v1/integrations/quickbooks/callback'
    );
  }

  private client() {
    const clientId = this.config.get<string>('QBO_CLIENT_ID');
    const clientSecret = this.config.get<string>('QBO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('QuickBooks OAuth is not configured (set QBO_CLIENT_ID / QBO_CLIENT_SECRET)');
    }
    return new OAuthClient({
      clientId,
      clientSecret,
      environment: (this.config.get<string>('QBO_ENVIRONMENT') ?? 'sandbox') as 'sandbox' | 'production',
      redirectUri: this.redirectUri(),
    });
  }

  /** Consent URL; the signed `state` carries the org + admin through the redirect. */
  async authUrl(userId: string, orgId: string): Promise<string> {
    const state = await this.jwt.signAsync({ sub: userId, orgId, kind: 'qbo_oauth' }, { expiresIn: '10m' });
    return this.client().authorizeUri({ scope: [OAuthClient.scopes.Accounting], state });
  }

  /** Exchange the code for tokens and store the encrypted per-org connection. */
  async handleCallback(code: string, state: string, realmId: string): Promise<{ orgId: string }> {
    let payload: StatePayload;
    try {
      payload = await this.jwt.verifyAsync<StatePayload>(state);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (payload.kind !== 'qbo_oauth') throw new BadRequestException('Invalid OAuth state');
    const { sub: userId, orgId } = payload;

    const oauth = this.client();
    const url = `${this.redirectUri()}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(
      state,
    )}&realmId=${encodeURIComponent(realmId)}`;
    const authResponse = await oauth.createToken(url);
    const t = authResponse.getJson();

    const now = Date.now();
    const data = {
      realmId,
      accessToken: encryptToken(t.access_token),
      refreshToken: encryptToken(t.refresh_token),
      tokenExpiry: new Date(now + (t.expires_in ?? 3600) * 1000),
      refreshTokenExpiry: new Date(now + (t.x_refresh_token_expires_in ?? 8640000) * 1000),
      status: 'connected',
      connectedBy: userId,
      lastError: null,
    };
    await this.prisma.quickBooksConnection.upsert({
      where: { orgId },
      create: { orgId, ...data },
      update: data,
    });
    return { orgId };
  }

  async status(orgId: string) {
    const c = await this.prisma.quickBooksConnection.findUnique({
      where: { orgId },
      select: { status: true, realmId: true, updatedAt: true, lastRefreshAt: true },
    });
    return {
      connected: !!c && c.status === 'connected',
      status: c?.status ?? 'disconnected',
      realmId: c?.realmId ?? null,
      updatedAt: c?.updatedAt ?? null,
    };
  }

  async disconnect(orgId: string) {
    await this.prisma.quickBooksConnection.deleteMany({ where: { orgId } });
  }
}
