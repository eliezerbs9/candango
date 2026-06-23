import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityFilters, CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

const withParticipants = {
  participants: { include: { person: { select: { id: true, name: true } } } },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof withParticipants }>;

function shape(a: ActivityRow) {
  return {
    id: a.id,
    type: a.type,
    subject: a.subject,
    dueAt: a.dueAt,
    startAt: a.startAt,
    endAt: a.endAt,
    location: a.location,
    locationType: a.locationType,
    conferenceUrl: a.conferenceUrl,
    done: a.done,
    dealId: a.dealId,
    personId: a.personId,
    assignedUserId: a.assignedUserId,
    participants: a.participants.map((p) => p.person),
    createdAt: a.createdAt,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Persons that belong to this tenant (filter to prevent cross-tenant links). */
  private async validPersonIds(orgId: string, ids?: string[]): Promise<string[]> {
    if (!ids?.length) return [];
    const rows = await this.prisma.person.findMany({
      where: { orgId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** The people attached to a deal: its primary person + its company's contacts. */
  private async dealPeople(orgId: string, dealId: string): Promise<string[]> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: { primaryPersonId: true, company: { select: { contacts: { select: { personId: true } } } } },
    });
    if (!deal) return [];
    const ids = new Set<string>();
    if (deal.primaryPersonId) ids.add(deal.primaryPersonId);
    deal.company?.contacts.forEach((c) => ids.add(c.personId));
    return [...ids];
  }

  async list(orgId: string, filters: ActivityFilters = {}) {
    const where: Prisma.ActivityWhereInput = { orgId };
    if (filters.dealId) where.dealId = filters.dealId;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.type) where.type = filters.type;
    // Date range matches either a meeting's start or a task's due date.
    if (filters.from || filters.to) {
      const range: Prisma.DateTimeFilter = {};
      if (filters.from) range.gte = new Date(filters.from);
      if (filters.to) range.lte = new Date(filters.to);
      where.OR = [{ startAt: range }, { dueAt: range }];
    }
    const rows = await this.prisma.activity.findMany({
      where,
      orderBy: [{ done: 'asc' }, { startAt: 'asc' }, { dueAt: 'asc' }],
      include: withParticipants,
    });
    return rows.map(shape);
  }

  async create(orgId: string, currentUserId: string, dto: CreateActivityDto) {
    // Default participants to the deal's people when not given explicitly.
    let participantIds = await this.validPersonIds(orgId, dto.participantIds);
    if (!dto.participantIds && dto.dealId) participantIds = await this.dealPeople(orgId, dto.dealId);

    const row = await this.prisma.activity.create({
      data: {
        orgId,
        assignedUserId: dto.assignedUserId ?? currentUserId,
        type: dto.type,
        subject: dto.subject,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        location: dto.location ?? null,
        locationType: dto.locationType ?? null,
        conferenceUrl: dto.conferenceUrl ?? null,
        dealId: dto.dealId ?? null,
        personId: dto.personId ?? null,
        done: false,
        participants: { create: participantIds.map((personId) => ({ personId })) },
      },
      include: withParticipants,
    });
    const activity = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'activity.created', data: { activity } });
    return activity;
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.activity.findFirst({
      where: { id, orgId },
      include: withParticipants,
    });
    if (!row) throw new NotFoundException('Activity not found');
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateActivityDto) {
    await this.get(orgId, id);
    const data: Prisma.ActivityUncheckedUpdateInput = {
      subject: dto.subject,
      done: dto.done,
      location: dto.location,
      locationType: dto.locationType,
      conferenceUrl: dto.conferenceUrl,
      assignedUserId: dto.assignedUserId,
    };
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.startAt !== undefined) data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.dealId !== undefined) data.dealId = dto.dealId || null;
    if (dto.personId !== undefined) data.personId = dto.personId || null;
    await this.prisma.activity.update({ where: { id }, data });

    if (dto.participantIds !== undefined) {
      const ids = await this.validPersonIds(orgId, dto.participantIds);
      await this.prisma.activityParticipant.deleteMany({ where: { activityId: id } });
      if (ids.length) {
        await this.prisma.activityParticipant.createMany({
          data: ids.map((personId) => ({ activityId: id, personId })),
        });
      }
    }

    const row = await this.prisma.activity.findFirstOrThrow({ where: { id }, include: withParticipants });
    const activity = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'activity.updated', data: { activity } });
    return activity;
  }

  async complete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.activity.update({ where: { id }, data: { done: true } });
    const activity = await this.get(orgId, id);
    this.events.emit('webhook.event', { orgId, type: 'activity.completed', data: { activity } });
    return activity;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.activity.delete({ where: { id } });
  }
}
