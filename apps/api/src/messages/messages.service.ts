import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractBody, gmailClientFor } from './gmail-read.util';
import { SendMessageDto } from './dto/send.dto';

type MessageRow = {
  id: string;
  direction: string;
  fromAddress: string;
  toAddresses: Prisma.JsonValue;
  subject: string | null;
  snippet: string | null;
  folder: string;
  labels: string[];
  threadId: string | null;
  personId: string | null;
  dealId: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

const shape = (m: MessageRow) => ({
  id: m.id,
  direction: m.direction,
  fromAddress: m.fromAddress,
  toAddresses: (m.toAddresses as string[]) ?? [],
  subject: m.subject,
  snippet: m.snippet,
  folder: m.folder,
  unread: (m.labels ?? []).includes('UNREAD'),
  threadId: m.threadId,
  personId: m.personId,
  dealId: m.dealId,
  sentAt: m.sentAt,
  createdAt: m.createdAt,
});

interface ListFilters {
  dealId?: string;
  personId?: string;
  userId?: string;
  folder?: string;
  limit?: number;
  cursor?: string;
}

// A message can be in several folders (Gmail labels) — e.g. a self-email is SENT + INBOX.
const FOLDER_LABEL: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
  trash: 'TRASH',
  spam: 'SPAM',
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Synced emails, newest first, cursor-paginated. Filter by deal, person, mailbox, or folder. */
  async list(orgId: string, filters: ListFilters) {
    const limit = Math.min(filters.limit ?? 25, 100);
    const label = filters.folder ? FOLDER_LABEL[filters.folder] : undefined;
    const where: Prisma.MessageWhereInput = {
      orgId,
      dealId: filters.dealId,
      personId: filters.personId,
      userId: filters.userId,
      ...(label ? { labels: { has: label } } : {}),
    };
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data: data.map(shape), nextCursor: hasMore ? data[data.length - 1].id : null };
  }

  /** A single message's metadata (the full-page reader fetches the body separately). */
  async get(orgId: string, id: string) {
    const m = await this.prisma.message.findFirst({ where: { id, orgId } });
    if (!m) throw new NotFoundException('Message not found');
    return shape(m);
  }

  /** Folder counts for the current user's mailbox (by Gmail label, so multi-label messages count in each). */
  async folderCounts(orgId: string, userId: string) {
    const entries = await Promise.all(
      Object.entries(FOLDER_LABEL).map(async ([folder, label]) => {
        const count = await this.prisma.message.count({ where: { orgId, userId, labels: { has: label } } });
        return [folder, count] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  /** Send an email via Gmail and record it as an outbound (Sent) message. */
  async send(orgId: string, userId: string, dto: SendMessageDto) {
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { userId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) {
      throw new BadRequestException('Connect your Google account to send email');
    }
    const gmail = gmailClientFor(conn);
    const from = (await gmail.users.getProfile({ userId: 'me' })).data.emailAddress ?? '';

    const headers = [`To: ${dto.to.join(', ')}`, `From: ${from}`, `Subject: ${dto.subject}`];
    if (dto.inReplyTo) headers.push(`In-Reply-To: ${dto.inReplyTo}`, `References: ${dto.inReplyTo}`);
    headers.push('Content-Type: text/plain; charset="UTF-8"', '', dto.body);
    const raw = Buffer.from(headers.join('\r\n')).toString('base64url');

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, ...(dto.threadId ? { threadId: dto.threadId } : {}) },
    });

    // Match the first recipient to a person in the org.
    const persons = await this.prisma.person.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, emails: true },
    });
    const byEmail = new Map<string, string>();
    for (const p of persons) for (const e of (p.emails as string[]) ?? []) byEmail.set(e.toLowerCase(), p.id);
    const personId = dto.to.map((e) => byEmail.get(e.toLowerCase())).find(Boolean) ?? null;

    const msg = await this.prisma.message.create({
      data: {
        orgId,
        userId,
        direction: 'out',
        providerMessageId: sent.data.id ?? `local_${Date.now()}`,
        threadId: sent.data.threadId ?? null,
        fromAddress: from,
        toAddresses: dto.to as Prisma.InputJsonValue,
        subject: dto.subject,
        snippet: dto.body.slice(0, 200),
        folder: 'sent',
        labels: ['SENT'], // the next Gmail sync refreshes with the real labels (e.g. + INBOX for self-emails)
        personId,
        dealId: dto.dealId ?? null,
        sentAt: new Date(),
      },
    });
    return shape(msg);
  }

  private async mailbox(orgId: string, id: string) {
    const msg = await this.prisma.message.findFirst({
      where: { id, orgId },
      select: { providerMessageId: true, userId: true, labels: true },
    });
    if (!msg) throw new NotFoundException('Message not found');
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { userId: msg.userId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) {
      throw new BadRequestException('Mailbox not connected');
    }
    return { msg, gmail: gmailClientFor(conn) };
  }

  /** Mark a message read in Gmail (remove the UNREAD label) and locally. Needs `gmail.modify`. */
  async markRead(orgId: string, id: string) {
    const { msg, gmail } = await this.mailbox(orgId, id);
    if (!msg.labels.includes('UNREAD')) return this.get(orgId, id); // already read
    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.providerMessageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    const updated = await this.prisma.message.update({
      where: { id },
      data: { labels: msg.labels.filter((l) => l !== 'UNREAD') },
    });
    return shape(updated);
  }

  /** Move a message to Trash in Gmail and locally. Needs `gmail.modify`. */
  async trash(orgId: string, id: string) {
    const { msg, gmail } = await this.mailbox(orgId, id);
    await gmail.users.messages.trash({ userId: 'me', id: msg.providerMessageId });
    const updated = await this.prisma.message.update({
      where: { id },
      data: { labels: ['TRASH'], folder: 'trash' },
    });
    return shape(updated);
  }

  /** Fetch the full body on demand from Gmail (bodies aren't stored). */
  async body(orgId: string, id: string) {
    const msg = await this.prisma.message.findFirst({
      where: { id, orgId },
      select: { providerMessageId: true, userId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { userId: msg.userId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) {
      throw new BadRequestException('Mailbox not connected');
    }
    const gmail = gmailClientFor(conn);
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.providerMessageId, format: 'full' });
    const { text, html } = extractBody(full.data.payload ?? undefined);
    return { html: html || null, text: text || null };
  }
}
