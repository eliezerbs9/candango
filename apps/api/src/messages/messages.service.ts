import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type MessageRow = {
  id: string;
  direction: string;
  fromAddress: string;
  toAddresses: Prisma.JsonValue;
  subject: string | null;
  snippet: string | null;
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
  personId: m.personId,
  dealId: m.dealId,
  sentAt: m.sentAt,
  createdAt: m.createdAt,
});

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Synced email messages, newest first. Filter by deal, person, or the current user's mailbox. */
  async list(orgId: string, filters: { dealId?: string; personId?: string; userId?: string }) {
    const rows = await this.prisma.message.findMany({
      where: { orgId, dealId: filters.dealId, personId: filters.personId, userId: filters.userId },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map(shape);
  }
}
