import { OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from './prisma.service';
import { decryptToken, encryptToken } from './crypto.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_URL = 'https://app.companycam.com/oauth/token';

/**
 * Keeps CompanyCam connections alive. The API refreshes on use, but a workspace nobody opens for
 * weeks would sit on a refresh token that may lapse — this daily pass rotates it so an idle tenant
 * never has to reconnect. CompanyCam issues a NEW refresh token on every refresh, so both tokens
 * are rewritten each run. On a rejected grant → `reauth_required`; transient errors keep the
 * connection and only record `lastError`.
 */
@Processor('companycam-refresh')
export class CompanyCamRefreshProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('companycam-refresh') private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.add('refresh-all', {}, { repeat: { every: DAY_MS }, removeOnComplete: true, removeOnFail: true });
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'refresh-all') {
      const conns = await this.prisma.companyCamConnection.findMany({
        where: { status: 'connected' },
        select: { orgId: true },
      });
      for (const c of conns) await this.refresh(c.orgId);
      return;
    }
    await this.refresh((job.data as { orgId: string }).orgId);
  }

  private async refresh(orgId: string): Promise<void> {
    const conn = await this.prisma.companyCamConnection.findUnique({ where: { orgId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) return;

    const clientId = process.env.COMPANYCAM_CLIENT_ID ?? '';
    const clientSecret = process.env.COMPANYCAM_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) return; // not configured in this environment — nothing to do

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: decryptToken(conn.refreshToken),
        }),
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        const fatal = res.status === 400 || res.status === 401;
        await this.prisma.companyCamConnection.update({
          where: { orgId },
          data: {
            lastError: `refresh failed (${res.status}): ${text.slice(0, 200)}`,
            ...(fatal ? { status: 'reauth_required' } : {}),
          },
        });
        return;
      }
      const t = JSON.parse(text) as { access_token: string; refresh_token: string; expires_in?: number };
      await this.prisma.companyCamConnection.update({
        where: { orgId },
        data: {
          accessToken: encryptToken(t.access_token),
          refreshToken: encryptToken(t.refresh_token),
          tokenExpiry: new Date(Date.now() + (t.expires_in ?? 7200) * 1000),
          lastRefreshAt: new Date(),
          status: 'connected',
          lastError: null,
        },
      });
    } catch (e) {
      // Network/transient: keep the connection, record why.
      await this.prisma.companyCamConnection.update({
        where: { orgId },
        data: { lastError: e instanceof Error ? e.message.slice(0, 300) : 'CompanyCam refresh failed' },
      });
    }
  }
}
