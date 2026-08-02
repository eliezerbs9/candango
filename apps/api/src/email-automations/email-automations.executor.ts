import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import {
  buildSignatureValues,
  buildTemplateContext,
  normalizeSignature,
  renderSignatureHtml,
  renderTemplate,
} from '../email-templates/template-vars';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AutomationRow {
  id: string;
  action: string;
  config: unknown;
  templateId: string | null;
  template?: { subject: string; body: string } | null;
}

/**
 * Performs an automation's action for a deal — either sending an email template (from the deal
 * owner's mailbox, with the workspace signature) or creating an activity/task on the deal. Shared
 * by the event-driven runner and the time-based scan. Every call is best-effort and self-contained.
 */
@Injectable()
export class EmailAutomationsExecutor {
  private readonly logger = new Logger(EmailAutomationsExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
  ) {}

  async fireForDeal(orgId: string, dealId: string, auto: AutomationRow): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: {
        title: true,
        value: true,
        currency: true,
        ownerUserId: true,
        primaryPersonId: true,
        primaryPerson: { select: { firstName: true, lastName: true, name: true, emails: true, phones: true } },
        company: { select: { name: true } },
      },
    });
    if (!deal || !deal.ownerUserId) return;

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

    if (auto.action === 'create_activity') {
      await this.createActivity(orgId, dealId, deal.ownerUserId, deal.primaryPersonId, auto, ctx);
      return;
    }

    // send_email
    if (!auto.template) return;
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
    await this.messages.send(orgId, deal.ownerUserId, { to: [recipient], subject, body, html: true, dealId });
    this.logger.log(`automation ${auto.id} sent to ${recipient} for deal ${dealId}`);
  }

  private async createActivity(
    orgId: string,
    dealId: string,
    ownerUserId: string,
    primaryPersonId: string | null,
    auto: AutomationRow,
    ctx: Record<string, string>,
  ): Promise<void> {
    const config = (auto.config ?? {}) as Record<string, unknown>;
    const rawType = String(config.activityType ?? 'task');
    const type = ['task', 'call', 'meeting'].includes(rawType) ? rawType : 'task';
    const subject = renderTemplate(String(config.activitySubject ?? 'Follow up').trim() || 'Follow up', ctx).slice(0, 300);
    const dueInDays = Number.isFinite(Number(config.dueInDays)) ? Math.max(0, Math.floor(Number(config.dueInDays))) : 0;
    const when = new Date(Date.now() + dueInDays * DAY_MS);

    await this.prisma.activity.create({
      data: {
        orgId,
        dealId,
        personId: primaryPersonId ?? null,
        assignedUserId: ownerUserId,
        type,
        subject,
        done: false,
        ...(type === 'meeting'
          ? { startAt: when, endAt: new Date(when.getTime() + 60 * 60 * 1000), locationType: 'none' }
          : { dueAt: when }),
      },
    });
    this.logger.log(`automation ${auto.id} created ${type} "${subject}" on deal ${dealId}`);
  }
}
