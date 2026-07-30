import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';

export interface DealFilters {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  ownerUserId?: string;
  archived?: boolean;
}

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private emit(orgId: string, type: string, deal: unknown) {
    this.events.emit('webhook.event', { orgId, type, data: { deal } });
  }

  private logStage(orgId: string, dealId: string, fromStageId: string | null, toStageId: string, userId?: string) {
    return this.prisma.dealStageEvent.create({
      data: { orgId, dealId, fromStageId, toStageId, changedByUserId: userId ?? null },
    });
  }

  /** The stages a deal passed through (oldest first), with stage names resolved. */
  async stageHistory(orgId: string, id: string) {
    await this.get(orgId, id);
    const events = await this.prisma.dealStageEvent.findMany({
      where: { orgId, dealId: id },
      orderBy: { createdAt: 'asc' },
    });
    const ids = [...new Set(events.flatMap((e) => [e.fromStageId, e.toStageId]).filter(Boolean))] as string[];
    const stages = await this.prisma.stage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameOf = (sid: string | null) => (sid ? (stages.find((s) => s.id === sid)?.name ?? null) : null);
    return events.map((e) => ({
      id: e.id,
      fromStage: e.fromStageId ? { id: e.fromStageId, name: nameOf(e.fromStageId) } : null,
      toStage: { id: e.toStageId, name: nameOf(e.toStageId) },
      changedByUserId: e.changedByUserId,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Unified, cursor-paginated deal timeline — merges notes, activities, stage
   * events and emails newest-first. Cursor is "<ISO at>|<id>"; we over-fetch
   * `limit + 1` of the newest-after-cursor rows from each source, merge, sort by
   * (at desc, id desc) and slice — so each page is a real DB fetch, not the
   * whole history. `at` = a message's sentAt (else createdAt), createdAt for the
   * rest.
   */
  async timeline(orgId: string, id: string, cursor?: string, limit = 15) {
    await this.get(orgId, id);
    const take = Math.min(Math.max(limit, 1), 50);

    let cursorAt: Date | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const sep = cursor.lastIndexOf('|');
      cursorAt = new Date(cursor.slice(0, sep));
      cursorId = cursor.slice(sep + 1);
    }
    // "strictly older than (cursorAt, cursorId)" for a given date column.
    const olderCreated = cursor
      ? { OR: [{ createdAt: { lt: cursorAt! } }, { createdAt: cursorAt!, id: { lt: cursorId! } }] }
      : {};
    const olderSent = cursor
      ? { OR: [{ sentAt: { lt: cursorAt! } }, { sentAt: cursorAt!, id: { lt: cursorId! } }] }
      : {};
    const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [notes, activities, stageEvents, messages] = await Promise.all([
      this.prisma.note.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
        include: { author: { select: { name: true, email: true } } },
      }),
      this.prisma.activity.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
      }),
      this.prisma.dealStageEvent.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
      }),
      this.prisma.message.findMany({
        where: { orgId, dealId: id, ...olderSent },
        orderBy: [{ sentAt: 'desc' as const }, { id: 'desc' as const }],
        take: take + 1,
      }),
    ]);

    const stageIds = [
      ...new Set(stageEvents.flatMap((e) => [e.fromStageId, e.toStageId]).filter(Boolean)),
    ] as string[];
    const stages = stageIds.length
      ? await this.prisma.stage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } })
      : [];
    const nameOf = (sid: string | null) => (sid ? stages.find((s) => s.id === sid)?.name ?? null : null);

    type Item = { kind: string; at: Date; id: string; [k: string]: unknown };
    const pool: Item[] = [
      ...notes.map((n) => ({ kind: 'note', at: n.createdAt, id: n.id, body: n.body, author: n.author.name || n.author.email })),
      ...activities.map((a) => ({ kind: 'activity', at: a.createdAt, id: a.id, atype: a.type, subject: a.subject, done: a.done })),
      ...stageEvents.map((e) => ({ kind: 'stage', at: e.createdAt, id: e.id, from: nameOf(e.fromStageId), to: nameOf(e.toStageId) ?? 'Stage' })),
      ...messages.map((m) => ({ kind: 'email', at: m.sentAt ?? m.createdAt, id: m.id, direction: m.direction, subject: m.subject, snippet: m.snippet, from: m.fromAddress, threadId: m.threadId })),
    ];
    pool.sort((x, y) => {
      const d = y.at.getTime() - x.at.getTime();
      return d !== 0 ? d : x.id < y.id ? 1 : -1;
    });

    const hasMore = pool.length > take;
    const page = pool.slice(0, take);
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${last.at.toISOString()}|${last.id}` : null;
    return { items: page.map((i) => ({ ...i, at: i.at.toISOString() })), nextCursor };
  }

  list(orgId: string, filters: DealFilters = {}) {
    return this.prisma.deal.findMany({
      where: {
        orgId,
        deletedAt: null,
        archivedAt: filters.archived ? { not: null } : null, // active by default; archived view on request
        pipelineId: filters.pipelineId,
        stageId: filters.stageId,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(orgId: string, ownerUserId: string, dto: CreateDealDto) {
    // Auto-fill Bill To from the payer (company, else the primary person) when not provided; Ship To stays empty.
    let billTo = dto.billTo as Prisma.InputJsonValue | undefined;
    if (!billTo && dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, orgId },
        select: { name: true, address: true },
      });
      if (company) {
        billTo = { name: company.name, ...((company.address as Record<string, unknown>) ?? {}) };
      }
    }
    if (!billTo && dto.primaryPersonId) {
      const person = await this.prisma.person.findFirst({
        where: { id: dto.primaryPersonId, orgId },
        select: { name: true, address: true },
      });
      if (person) {
        billTo = { name: person.name, ...((person.address as Record<string, unknown>) ?? {}) };
      }
    }
    // Assign a human-readable per-tenant deal number from an atomic org counter.
    const deal = await this.prisma.$tx(async (tx) => {
      const org = await tx.organization.update({
        where: { id: orgId },
        data: { dealSeq: { increment: 1 } },
        select: { dealSeq: true },
      });
      return tx.deal.create({
        data: {
          orgId,
          ownerUserId,
          refNumber: org.dealSeq,
          title: dto.title,
          value: dto.value ?? 0,
          currency: dto.currency ?? 'USD',
          pipelineId: dto.pipelineId,
          stageId: dto.stageId,
          primaryPersonId: dto.primaryPersonId ?? null,
          companyId: dto.companyId ?? null,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          shipTo: dto.shipTo as Prisma.InputJsonValue | undefined,
          billTo,
          customFields: dto.customFields as Prisma.InputJsonValue | undefined,
          status: 'open',
          stageChangedAt: new Date(),
        },
      });
    });
    await this.logStage(orgId, deal.id, null, deal.stageId, ownerUserId);
    this.emit(orgId, 'deal.created', deal);
    return deal;
  }

  async get(orgId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async update(orgId: string, id: string, dto: UpdateDealDto, currentUserId?: string) {
    const before = await this.get(orgId, id);
    const data: Prisma.DealUncheckedUpdateInput = {
      title: dto.title,
      value: dto.value,
      currency: dto.currency,
    };
    if (dto.ownerUserId) data.ownerUserId = dto.ownerUserId;
    if (dto.primaryPersonId !== undefined) data.primaryPersonId = dto.primaryPersonId || null;
    if (dto.companyId !== undefined) data.companyId = dto.companyId || null;
    if (dto.expectedCloseDate) data.expectedCloseDate = new Date(dto.expectedCloseDate);
    if (dto.shipTo !== undefined) data.shipTo = dto.shipTo as Prisma.InputJsonValue;
    if (dto.billTo !== undefined) data.billTo = dto.billTo as Prisma.InputJsonValue;
    if (dto.customFields !== undefined) data.customFields = dto.customFields as Prisma.InputJsonValue;
    if (dto.stageId) {
      data.stageId = dto.stageId;
      data.stageChangedAt = new Date(); // moving stage resets the rotting timer
    }
    const deal = await this.prisma.deal.update({ where: { id }, data });
    if (dto.stageId && dto.stageId !== before.stageId) {
      await this.logStage(orgId, id, before.stageId, dto.stageId, currentUserId);
      this.emit(orgId, 'deal.stage_changed', deal);
    }
    this.emit(orgId, 'deal.updated', deal);
    return deal;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
    this.emit(orgId, 'deal.deleted', { id });
  }

  /** System note on the deal timeline recording a lifecycle change. */
  private logStatusNote(orgId: string, dealId: string, userId: string, body: string) {
    return this.prisma.note.create({ data: { orgId, dealId, authorUserId: userId, body } });
  }

  async win(orgId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({ where: { id }, data: { status: 'won' } });
    await this.logStatusNote(orgId, id, userId, '✅ Deal marked won');
    this.emit(orgId, 'deal.won', deal);
    return deal;
  }

  async lose(orgId: string, id: string, userId: string, lostReason?: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { status: 'lost', lostReason: lostReason ?? null },
    });
    await this.logStatusNote(orgId, id, userId, `🔴 Deal marked lost${lostReason ? `: ${lostReason}` : ''}`);
    this.emit(orgId, 'deal.lost', deal);
    return deal;
  }

  /** Reopen a won/lost/archived deal back to open (clears archive + lost reason; resets rotting timer). */
  async reopen(orgId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { status: 'open', lostReason: null, archivedAt: null, stageChangedAt: new Date() },
    });
    await this.logStatusNote(orgId, id, userId, '↩️ Deal reopened');
    this.emit(orgId, 'deal.reopened', deal);
    return deal;
  }

  /** Archive a deal: hidden from active views but kept (distinct from delete). */
  async archive(orgId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.logStatusNote(orgId, id, userId, '📦 Deal archived');
    this.emit(orgId, 'deal.archived', deal);
    return deal;
  }
}
