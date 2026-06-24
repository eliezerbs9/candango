import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractBody, gmailClientFor } from './gmail-read.util';

type MessageRow = {
  id: string;
  direction: string;
  fromAddress: string;
  toAddresses: Prisma.JsonValue;
  subject: string | null;
  snippet: string | null;
  folder: string;
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

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Synced emails, newest first, cursor-paginated. Filter by deal, person, mailbox, or folder. */
  async list(orgId: string, filters: ListFilters) {
    const limit = Math.min(filters.limit ?? 25, 100);
    const where: Prisma.MessageWhereInput = {
      orgId,
      dealId: filters.dealId,
      personId: filters.personId,
      userId: filters.userId,
      folder: filters.folder,
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

  /** Folder counts for the current user's mailbox (for the screen's tabs). */
  async folderCounts(orgId: string, userId: string) {
    const grouped = await this.prisma.message.groupBy({
      by: ['folder'],
      where: { orgId, userId },
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.folder, g._count._all]));
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
