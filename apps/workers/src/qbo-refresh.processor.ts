import { OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import OAuthClient from 'intuit-oauth';
import { PrismaService } from './prisma.service';
import { decryptToken, encryptToken } from './crypto.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps QuickBooks connections alive (FR-13 token persistence): a daily refresh rotates the
 * access + refresh tokens and persists them, so an idle tenant never crosses QBO's ~100-day
 * refresh-token window — no repeated OAuth logins. On an expired refresh token → `reauth_required`.
 */
@Processor('qbo-refresh')
export class QboRefreshProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('qbo-refresh') private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.add('refresh-all', {}, { repeat: { every: DAY_MS }, removeOnComplete: true, removeOnFail: true });
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'refresh-all') {
      const conns = await this.prisma.quickBooksConnection.findMany({
        where: { status: 'connected' },
        select: { orgId: true },
      });
      for (const c of conns) await this.refresh(c.orgId);
      return;
    }
    await this.refresh((job.data as { orgId: string }).orgId);
  }

  private oauthClient() {
    return new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID ?? '',
      clientSecret: process.env.QBO_CLIENT_SECRET ?? '',
      environment: (process.env.QBO_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production',
      redirectUri: process.env.QBO_REDIRECT_URI ?? 'http://localhost:4000/v1/integrations/quickbooks/callback',
    });
  }

  private async refresh(orgId: string): Promise<void> {
    const conn = await this.prisma.quickBooksConnection.findUnique({ where: { orgId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) return;

    const oauth = this.oauthClient();
    oauth.setToken({
      token_type: 'bearer',
      access_token: decryptToken(conn.accessToken),
      refresh_token: decryptToken(conn.refreshToken),
      expires_in: 3600,
      x_refresh_token_expires_in: 8640000,
      realmId: conn.realmId,
    });

    try {
      const t = (await oauth.refresh()).getJson();
      const now = Date.now();
      await this.prisma.quickBooksConnection.update({
        where: { orgId },
        data: {
          accessToken: encryptToken(t.access_token),
          refreshToken: encryptToken(t.refresh_token),
          tokenExpiry: new Date(now + (t.expires_in ?? 3600) * 1000),
          refreshTokenExpiry: new Date(now + (t.x_refresh_token_expires_in ?? 8640000) * 1000),
          lastRefreshAt: new Date(),
          status: 'connected',
          lastError: null,
        },
      });
    } catch (e) {
      const err = e as { authResponse?: { status?: number }; response?: { status?: number }; message?: string };
      const httpStatus = err.authResponse?.status ?? err.response?.status;
      const reauth = httpStatus === 400 || httpStatus === 401; // refresh token expired/revoked
      await this.prisma.quickBooksConnection.update({
        where: { orgId },
        data: {
          ...(reauth ? { status: 'reauth_required' } : {}),
          lastError: `QBO refresh failed: ${err.message ?? 'unknown'}`.slice(0, 300),
        },
      });
      if (!reauth) throw e instanceof Error ? e : new Error('QBO refresh failed'); // transient → BullMQ retries
    }
  }
}
