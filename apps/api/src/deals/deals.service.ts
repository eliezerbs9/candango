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

  list(orgId: string, filters: DealFilters = {}) {
    return this.prisma.deal.findMany({
      where: {
        orgId,
        deletedAt: null,
        pipelineId: filters.pipelineId,
        stageId: filters.stageId,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(orgId: string, ownerUserId: string, dto: CreateDealDto) {
    // Auto-fill Bill To from the company (payer) when not provided; Ship To (work site) stays empty.
    let billTo = dto.billTo as Prisma.InputJsonValue | undefined;
    if (!billTo && dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, orgId },
        select: { name: true, address: true },
      });
      if (company) {
        billTo = { name: company.name, ...(company.address ? { line1: company.address } : {}) };
      }
    }
    // Assign a human-readable per-tenant deal number from an atomic org counter.
    const deal = await this.prisma.$transaction(async (tx) => {
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

  async win(orgId: string, id: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({ where: { id }, data: { status: 'won' } });
    this.emit(orgId, 'deal.won', deal);
    return deal;
  }

  async lose(orgId: string, id: string, lostReason?: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { status: 'lost', lostReason: lostReason ?? null },
    });
    this.emit(orgId, 'deal.lost', deal);
    return deal;
  }
}
