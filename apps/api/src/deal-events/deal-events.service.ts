import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DealEventKind = 'automation' | 'proposal' | 'signature' | 'email';

export interface DealEventInput {
  kind: DealEventKind;
  title: string;
  body?: string | null;
  /** Who/what caused it — e.g. "Automation · Follow-up", "Client via proposal link", a signer's name. */
  actor?: string | null;
}

/**
 * System/automation activity on a deal (automation runs, proposal responses, signature lifecycle)
 * surfaced on the deal Activity timeline. Logging must never break the action that triggered it,
 * so `log` swallows its own errors.
 */
@Injectable()
export class DealEventsService {
  private readonly logger = new Logger(DealEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(orgId: string, dealId: string, e: DealEventInput): Promise<void> {
    try {
      await this.prisma.dealEvent.create({
        data: { orgId, dealId, kind: e.kind, title: e.title, body: e.body ?? null, actor: e.actor ?? null },
      });
    } catch (err) {
      this.logger.warn(`failed to log deal event for ${dealId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  list(orgId: string, dealId: string) {
    return this.prisma.dealEvent.findMany({
      where: { orgId, dealId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, title: true, body: true, actor: true, createdAt: true },
    });
  }
}
