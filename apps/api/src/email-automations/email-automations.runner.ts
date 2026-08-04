import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAutomationsExecutor } from './email-automations.executor';

/** Domain event `type` → automation trigger key (event-driven triggers only). */
const EVENT_TO_TRIGGER: Record<string, string> = {
  'deal.stage_changed': 'deal_stage_changed',
  'deal.won': 'deal_won',
  'deal.lost': 'deal_lost',
  'deal.doc_sent': 'doc_sent',
  'proposal.accepted': 'proposal_accepted',
  'document.signed': 'document_signed',
};

interface WebhookEvent {
  orgId: string;
  type: string;
  data?: { deal?: { id?: string; stageId?: string }; docKind?: string } & Record<string, unknown>;
}

/**
 * Runs event-driven automations (FR-16.3). Subscribes to the same `webhook.event` stream the
 * webhooks use; on a matching trigger it fires the automation's action (email or activity) via the
 * shared executor. Fully guarded — a failure never affects the action that emitted the event. The
 * time-based triggers (overdue / follow-up) run from the scan processor.
 */
@Injectable()
export class EmailAutomationsRunner {
  private readonly logger = new Logger(EmailAutomationsRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: EmailAutomationsExecutor,
  ) {}

  @OnEvent('webhook.event')
  async handle(payload: WebhookEvent): Promise<void> {
    const trigger = EVENT_TO_TRIGGER[payload.type];
    const dealId = payload.data?.deal?.id;
    if (!trigger || !dealId || !payload.orgId) return;
    try {
      const autos = await this.prisma.emailAutomation.findMany({
        where: { orgId: payload.orgId, archivedAt: null, enabled: true, trigger },
        include: { template: { select: { subject: true, body: true } } },
      });
      for (const auto of autos) {
        if (!this.matches(auto, payload)) continue;
        await this.executor
          .fireForDeal(payload.orgId, dealId, auto)
          .catch((e) => this.logger.warn(`automation ${auto.id} failed: ${e instanceof Error ? e.message : String(e)}`));
      }
    } catch (e) {
      this.logger.warn(`automation dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Trigger-config filters we can evaluate straight from the event payload. */
  private matches(auto: { trigger: string; config: unknown }, payload: WebhookEvent): boolean {
    const config = (auto.config ?? {}) as Record<string, unknown>;
    if (auto.trigger === 'deal_stage_changed' && typeof config.stageId === 'string' && config.stageId) {
      return config.stageId === payload.data?.deal?.stageId;
    }
    if (auto.trigger === 'doc_sent' && typeof config.docKind === 'string' && config.docKind) {
      return config.docKind === payload.data?.docKind;
    }
    return true;
  }
}
