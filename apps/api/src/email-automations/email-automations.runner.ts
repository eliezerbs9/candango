import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import {
  buildSignatureValues,
  buildTemplateContext,
  normalizeSignature,
  renderSignatureHtml,
  renderTemplate,
} from '../email-templates/template-vars';

/** Domain event `type` → automation trigger key (event-driven triggers only). */
const EVENT_TO_TRIGGER: Record<string, string> = {
  'deal.stage_changed': 'deal_stage_changed',
  'deal.won': 'deal_won',
  'deal.lost': 'deal_lost',
  'deal.doc_sent': 'doc_sent',
};

interface WebhookEvent {
  orgId: string;
  type: string;
  data?: { deal?: { id?: string }; docKind?: string } & Record<string, unknown>;
}

/**
 * Runs event-driven email automations (FR-16.3). Subscribes to the same `webhook.event` stream
 * the webhooks use; on a matching trigger it renders the automation's template against the deal
 * and sends it from the deal owner's mailbox. Fully guarded — a failure never affects the action
 * that emitted the event. Time-based triggers (overdue / follow-up) run from a separate worker.
 */
@Injectable()
export class EmailAutomationsRunner {
  private readonly logger = new Logger(EmailAutomationsRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
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
        await this.run(payload.orgId, dealId, auto, payload).catch((e) =>
          this.logger.warn(`automation ${auto.id} failed: ${e instanceof Error ? e.message : String(e)}`),
        );
      }
    } catch (e) {
      this.logger.warn(`automation dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async run(
    orgId: string,
    dealId: string,
    auto: { id: string; trigger: string; config: unknown; template: { subject: string; body: string } },
    payload: WebhookEvent,
  ): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: {
        title: true,
        value: true,
        currency: true,
        ownerUserId: true,
        stageId: true,
        primaryPerson: { select: { firstName: true, lastName: true, name: true, emails: true, phones: true } },
        company: { select: { name: true } },
      },
    });
    if (!deal || !deal.ownerUserId) return;

    // Config filters for the event triggers that have them.
    const config = (auto.config ?? {}) as Record<string, unknown>;
    if (auto.trigger === 'deal_stage_changed' && typeof config.stageId === 'string' && config.stageId) {
      if (config.stageId !== deal.stageId) return;
    }
    if (auto.trigger === 'doc_sent' && typeof config.docKind === 'string' && config.docKind) {
      if (config.docKind !== payload.data?.docKind) return;
    }

    const [owner, org] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: deal.ownerUserId, orgId },
        select: { name: true, email: true, phone: true, avatarUrl: true },
      }),
      this.prisma.organization.findFirst({
        where: { id: orgId },
        select: { name: true, logoUrl: true, emailSignature: true },
      }),
    ]);

    const ctx = buildTemplateContext({
      person: deal.primaryPerson,
      company: deal.company,
      deal: { title: deal.title, value: deal.value, currency: deal.currency },
      sender: owner,
      workspace: org,
    });

    const recipient = ctx['contact.email'];
    if (!recipient) {
      this.logger.log(`automation ${auto.id}: deal ${dealId} has no contact email — skipped`);
      return;
    }

    const subject = renderTemplate(auto.template.subject, ctx);
    const signature = renderSignatureHtml(
      normalizeSignature(org?.emailSignature),
      buildSignatureValues(
        { name: owner?.name, email: owner?.email, phone: owner?.phone, avatarUrl: owner?.avatarUrl },
        { name: org?.name, logoUrl: org?.logoUrl },
      ),
    );
    const body = renderTemplate(auto.template.body, ctx) + signature;

    // Sends from the deal owner's connected mailbox; throws (caught by the caller) if none is connected.
    await this.messages.send(orgId, deal.ownerUserId, { to: [recipient], subject, body, html: true, dealId });
    this.logger.log(`automation ${auto.id} sent to ${recipient} for deal ${dealId}`);
  }
}
