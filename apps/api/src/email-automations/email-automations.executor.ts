import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { MailService } from '../mail/mail.service';
import { SignaturesService } from '../signatures/signatures.service';
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

export interface MarketingFireRow {
  id: string;
  template?: { subject: string; body: string } | null;
}

/** A contact resolved from a marketing audience (see EmailAutomationsService.resolveAudience). */
export interface MarketingRecipient {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  emails: unknown;
  phones: unknown;
  emailUnsubToken: string;
  companyLinks: { company: { name: string } }[];
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
    private readonly mail: MailService,
    private readonly signatures: SignaturesService,
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

    if (auto.action === 'request_signature') {
      await this.requestSignature(orgId, dealId, deal.ownerUserId, auto, ctx);
      return;
    }

    if (auto.action === 'move_stage') {
      const stageId = String((auto.config as Record<string, unknown> | null)?.stageId ?? '');
      // Direct stage set — no `deal.stage_changed` emit, so stage automations don't cascade/loop.
      if (stageId) {
        await this.prisma.deal.update({ where: { id: dealId }, data: { stageId } }).catch((e) => this.logger.warn(`automation ${auto.id} move_stage failed: ${e}`));
        this.logger.log(`automation ${auto.id} moved deal ${dealId} to stage ${stageId}`);
      }
      return;
    }

    if (auto.action === 'add_tag') {
      const tag = String((auto.config as Record<string, unknown> | null)?.tag ?? '').trim();
      if (tag && deal.primaryPersonId) {
        const person = await this.prisma.person.findFirst({ where: { id: deal.primaryPersonId, orgId }, select: { tags: true } });
        if (person && !person.tags.includes(tag)) {
          await this.prisma.person.update({ where: { id: deal.primaryPersonId }, data: { tags: { push: tag } } });
          this.logger.log(`automation ${auto.id} tagged contact of deal ${dealId} with "${tag}"`);
        }
      }
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
    try {
      await this.messages.send(orgId, deal.ownerUserId, { to: [recipient], subject, body, html: true, dealId });
      this.logger.log(`automation ${auto.id} sent to ${recipient} for deal ${dealId}`);
    } catch (err) {
      await this.handleEmailError(orgId, auto.id, err);
    }
  }

  /**
   * Fire a marketing automation: render its (marketing-scoped) template for each resolved recipient
   * and enqueue a send from the workspace via Brevo, with a per-contact unsubscribe link appended.
   * Recipients are already filtered to subscribed contacts with an email (see resolveAudience).
   */
  async fireMarketing(orgId: string, auto: MarketingFireRow, recipients: MarketingRecipient[]): Promise<void> {
    if (!auto.template || recipients.length === 0) return;
    const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true } });

    let sent = 0;
    for (const r of recipients) {
      const emails = (r.emails as string[]) ?? [];
      const to = emails.find((e) => typeof e === 'string' && e);
      if (!to) continue;
      const ctx = buildTemplateContext({
        person: { firstName: r.firstName, lastName: r.lastName, name: r.name, emails: r.emails, phones: r.phones },
        company: r.companyLinks[0]?.company ?? null,
        deal: null,
        sender: null,
        workspace: org,
      });
      const subject = renderTemplate(auto.template.subject, ctx);
      const bodyHtml = renderTemplate(auto.template.body, ctx);
      const unsubUrl = this.mail.unsubscribeUrl(r.emailUnsubToken);
      const html = bodyHtml + this.unsubscribeFooter(unsubUrl, org?.name ?? '');
      const text = `${stripHtml(bodyHtml)}\n\nUnsubscribe: ${unsubUrl}`;
      try {
        await this.mail.sendMarketing(to, r.name, { subject, html, text });
        sent++;
      } catch (err) {
        this.logger.warn(`marketing ${auto.id} enqueue to ${to} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    this.logger.log(`marketing automation ${auto.id} enqueued ${sent}/${recipients.length} sends`);
  }

  /** CAN-SPAM style unsubscribe footer appended to every marketing email. */
  private unsubscribeFooter(unsubUrl: string, orgName: string): string {
    return (
      `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5" />` +
      `<p style="font-size:12px;color:#888;line-height:1.5">` +
      `You received this because you subscribed to updates${orgName ? ` from ${escapeText(orgName)}` : ''}. ` +
      `<a href="${unsubUrl}" style="color:#888">Unsubscribe</a>.` +
      `</p>`
    );
  }

  /**
   * A send failure disables the automation (so it stops firing) and notifies both the workspace's
   * admins and the app developer (DEV_ALERT_EMAIL) via Brevo with the workspace + error.
   */
  private async handleEmailError(orgId: string, automationId: string, err: unknown): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`automation ${automationId} email failed → disabling: ${msg}`);
    try {
      const auto = await this.prisma.emailAutomation.update({
        where: { id: automationId },
        data: { enabled: false },
        select: { name: true },
      });
      const [org, admins] = await Promise.all([
        this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true } }),
        this.prisma.user.findMany({
          where: { orgId, deletedAt: null, status: 'active', role: { name: 'Admin' } },
          select: { email: true, name: true },
        }),
      ]);
      const orgName = org?.name ?? 'your workspace';
      for (const a of admins) void this.mail.sendAutomationDisabled(a.email, a.name, auto.name, orgName, msg);
      const dev = process.env.DEV_ALERT_EMAIL;
      if (dev) void this.mail.sendAutomationErrorToDev(dev, orgName, auto.name, automationId, msg);
    } catch (e) {
      this.logger.warn(`automation ${automationId} error-handling failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Generate a document from the automation's document template and send it to the deal's contact. */
  private async requestSignature(orgId: string, dealId: string, ownerUserId: string, auto: AutomationRow, ctx: Record<string, string>): Promise<void> {
    const config = (auto.config ?? {}) as Record<string, unknown>;
    const docId = String(config.signableDocumentTemplateId ?? '');
    if (!docId) return;
    if (!ctx['contact.email']) {
      this.logger.log(`automation ${auto.id}: deal ${dealId} has no contact email — signature skipped`);
      return;
    }
    try {
      await this.signatures.createGenerated(orgId, ownerUserId, {
        dealId,
        signableDocumentTemplateId: docId,
        signerEmail: ctx['contact.email'],
        signerName: ctx['contact.name'] || undefined,
        sendEmail: config.sendEmail !== false,
      });
      this.logger.log(`automation ${auto.id} sent a signature request for deal ${dealId}`);
    } catch (err) {
      this.logger.warn(`automation ${auto.id} signature request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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
