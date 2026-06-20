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
    const deal = await this.prisma.deal.create({
      data: {
        orgId,
        ownerUserId,
        title: dto.title,
        value: dto.value ?? 0,
        currency: dto.currency ?? 'USD',
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        primaryPersonId: dto.primaryPersonId ?? null,
        companyId: dto.companyId ?? null,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        status: 'open',
        stageChangedAt: new Date(),
      },
    });
    this.emit(orgId, 'deal.created', deal);
    return deal;
  }

  async get(orgId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async update(orgId: string, id: string, dto: UpdateDealDto) {
    await this.get(orgId, id);
    const data: Prisma.DealUpdateInput = {
      title: dto.title,
      value: dto.value,
    };
    if (dto.expectedCloseDate) data.expectedCloseDate = new Date(dto.expectedCloseDate);
    if (dto.ownerUserId) data.owner = { connect: { id: dto.ownerUserId } };
    if (dto.stageId) {
      data.stage = { connect: { id: dto.stageId } };
      data.stageChangedAt = new Date(); // moving stage resets the rotting timer
    }
    const deal = await this.prisma.deal.update({ where: { id }, data });
    if (dto.stageId) this.emit(orgId, 'deal.stage_changed', deal);
    return deal;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
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
