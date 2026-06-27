import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { runWithOrg } from '../prisma/tenant-context';
import { emailOf, parseCaptureAddress, parseCaptureToken, type CaptureTarget } from './capture.util';

/** A parsed inbound email, normalized across provider payload shapes. */
interface NormalizedMail {
  from: string;
  to: string[];
  cc: string[];
  /** Every recipient-ish address we can see (incl. envelope/delivered-to — where a BCC shows up). */
  recipients: string[];
  subject?: string;
  messageId?: string;
  text?: string;
  threadId?: string | null;
  date?: Date | null;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Handle a parsed inbound email from the provider webhook (Brevo Inbound / Mailgun / etc.):
   * verify the shared secret, find the capture token → user, match a person/deal, and store it.
   * Returns a small ack; never throws on unknown senders (avoid provider retries / backscatter).
   */
  async handle(body: unknown, providedSecret?: string) {
    const secret = this.config.get<string>('EMAIL_INBOUND_SECRET') ?? '';
    if (!secret || !providedSecret || !timingSafeEqualStr(providedSecret, secret)) {
      throw new UnauthorizedException('Invalid inbound webhook secret');
    }
    const domain = (this.config.get<string>('EMAIL_INBOUND_DOMAIN') ?? '').toLowerCase();
    if (!domain) {
      this.logger.warn('EMAIL_INBOUND_DOMAIN not configured; ignoring inbound email');
      return { ignored: true };
    }

    const mail = normalizeInbound(body);
    if (!mail) return { ignored: true };

    // Which capture address(es) was this delivered to? An email can carry both the user's and the
    // deal's address (we BCC both for deal emails) — prefer the deal address for attribution.
    const targets = mail.recipients
      .map((r) => parseCaptureAddress(r, domain))
      .filter((t): t is CaptureTarget => t !== null);
    const target = targets.find((t) => t.kind === 'deal') ?? targets.find((t) => t.kind === 'user') ?? null;
    if (!target) {
      this.logger.warn('Inbound email had no capture address; ignoring');
      return { ignored: true };
    }

    // Resolve org + the owning user + (for deal addresses) a forced deal. Unscoped: token is globally unique.
    let orgId: string;
    let userId: string;
    let userEmails: string[];
    let forcedDealId: string | null = null;
    if (target.kind === 'deal') {
      const deal = await this.prisma.deal.findUnique({
        where: { emailCaptureToken: target.token },
        select: { id: true, orgId: true, ownerUserId: true },
      });
      if (!deal) {
        this.logger.warn(`Inbound deal capture token not recognized: ${target.token.slice(0, 4)}…`);
        return { ignored: true };
      }
      orgId = deal.orgId;
      userId = deal.ownerUserId;
      forcedDealId = deal.id;
      const owner = await this.prisma.user.findUnique({ where: { id: deal.ownerUserId }, select: { email: true } });
      userEmails = owner ? [owner.email.toLowerCase()] : [];
    } else {
      const user = await this.prisma.user.findUnique({
        where: { emailCaptureToken: target.token },
        select: { id: true, orgId: true, email: true },
      });
      if (!user) {
        this.logger.warn(`Inbound user capture token not recognized: ${target.token.slice(0, 4)}…`);
        return { ignored: true };
      }
      orgId = user.orgId;
      userId = user.id;
      userEmails = [user.email.toLowerCase()];
    }

    // Everything below runs scoped to the resolved org (RLS-enforced).
    return runWithOrg(orgId, async () => {
      // Dedupe: a CRM-sent email returning via its own BCC (we already logged it on send).
      const rfcId = mail.messageId ? mail.messageId.replace(/^<|>$/g, '') : null;
      if (rfcId) {
        const existing = await this.prisma.message.findFirst({
          where: { orgId, rfcMessageId: rfcId },
          select: { id: true, dealId: true },
        });
        if (existing) return { ok: true, deduped: true, messageId: existing.id, dealId: existing.dealId };
      }

      const direction = userEmails.includes(mail.from) ? 'out' : 'in';
      const counterparts = (direction === 'out' ? [...mail.to, ...mail.cc] : [mail.from]).filter(
        (e) => e && !userEmails.includes(e) && parseCaptureToken(e, domain) === null,
      );

      const matched = await this.match(orgId, counterparts, mail.threadId);
      const dealId = forcedDealId ?? matched.dealId;
      const personId = matched.personId;

      const providerMessageId =
        rfcId ??
        `inbound_${createHash('sha1').update(`${mail.from}|${mail.subject ?? ''}|${mail.date?.toISOString() ?? ''}`).digest('hex')}`;

      const msg = await this.prisma.message.upsert({
        where: { userId_providerMessageId: { userId, providerMessageId } },
        create: {
          orgId,
          userId,
          direction,
          providerMessageId,
          rfcMessageId: rfcId,
          threadId: mail.threadId ?? null,
          fromAddress: mail.from,
          toAddresses: mail.to as Prisma.InputJsonValue,
          subject: mail.subject ?? null,
          snippet: (mail.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
          folder: direction === 'out' ? 'sent' : 'inbox',
          labels: direction === 'out' ? ['SENT'] : ['INBOX'],
          personId,
          dealId,
          sentAt: mail.date ?? new Date(),
        },
        update: { personId, dealId }, // idempotent re-delivery: refresh the match, keep the row
      });

      this.events.emit('webhook.event', {
        orgId,
        type: direction === 'in' ? 'message.received' : 'message.sent',
        data: { messageId: msg.id, dealId },
      });
      return { ok: true, messageId: msg.id, direction, dealId };
    });
  }

  /** Thread continuity → primary/participant/company-contact → newest open deal (mirrors the Gmail matcher). */
  private async match(orgId: string, counterparts: string[], threadId?: string | null) {
    let dealId: string | null = null;
    if (threadId) {
      const prior = await this.prisma.message.findFirst({
        where: { orgId, threadId, dealId: { not: null } },
        select: { dealId: true },
      });
      dealId = prior?.dealId ?? null;
    }

    const persons = await this.prisma.person.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, emails: true },
    });
    const byEmail = new Map<string, string>();
    for (const p of persons) for (const e of (p.emails as string[]) ?? []) byEmail.set(e.toLowerCase(), p.id);
    const personId = counterparts.map((e) => byEmail.get(e)).find(Boolean) ?? null;

    if (!dealId && personId) {
      const deal = await this.prisma.deal.findFirst({
        where: {
          orgId,
          status: 'open',
          deletedAt: null,
          OR: [
            { primaryPersonId: personId },
            { participants: { some: { personId } } },
            { company: { contacts: { some: { personId } } } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      dealId = deal?.id ?? null;
    }
    return { personId, dealId };
  }
}

/** Constant-time string compare (avoids leaking the secret via timing). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Normalize provider payloads (Brevo Inbound `{items:[…]}`, Mailgun, or a flat shape) into one shape. */
function normalizeInbound(body: unknown): NormalizedMail | null {
  const b = (body ?? {}) as Record<string, any>;
  const item = (Array.isArray(b.items) ? b.items[0] : b.item ?? b) as Record<string, any> | null;
  if (!item || typeof item !== 'object') return null;

  const addrs = (v: unknown): string[] => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr
      .map((x) => emailOf(typeof x === 'string' ? x : String((x as any)?.Address ?? (x as any)?.address ?? (x as any)?.email ?? '')))
      .filter(Boolean);
  };

  const from = addrs(item.From ?? item.from ?? item.sender ?? item.Sender)[0] ?? 'unknown';
  const to = addrs(item.To ?? item.to);
  const cc = addrs(item.Cc ?? item.cc);
  const recipients = dedupe([
    ...addrs(item.Recipient ?? item.recipient),
    ...addrs(item.RecipientsTo ?? item.OriginalRecipient ?? item.deliveredTo ?? item['delivered-to']),
    ...addrs(item.envelope?.to ?? b.envelope?.to),
    ...to,
    ...cc,
  ]);

  const subject = (item.Subject ?? item.subject ?? undefined) || undefined;
  const messageId = (item.MessageId ?? item.messageId ?? item['message-id'] ?? item['Message-Id'] ?? undefined) || undefined;
  const rawText = String(
    item.RawTextBody ?? item.text ?? item['body-plain'] ?? item.ExtractedMarkdownMessage ?? '',
  );
  const text = rawText || stripHtml(String(item.RawHtmlBody ?? item.html ?? ''));
  const threadId = (item.threadId ?? null) as string | null;
  const dateRaw = item.Date ?? item.date ?? item.SentAtDate ?? null;
  const parsed = dateRaw ? new Date(dateRaw) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  return { from, to, cc, recipients, subject, messageId, text, threadId, date };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
