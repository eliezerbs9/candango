import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.activity.findMany({
      where: { orgId },
      orderBy: [{ done: 'asc' }, { dueAt: 'asc' }],
    });
  }

  create(orgId: string, assignedUserId: string, dto: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        orgId,
        assignedUserId,
        type: dto.type,
        subject: dto.subject,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        dealId: dto.dealId ?? null,
        personId: dto.personId ?? null,
        done: false,
      },
    });
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.activity.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Activity not found');
    return row;
  }

  async update(orgId: string, id: string, dto: UpdateActivityDto) {
    await this.get(orgId, id);
    const data: Prisma.ActivityUpdateInput = { subject: dto.subject, done: dto.done };
    if (dto.dueAt) data.dueAt = new Date(dto.dueAt);
    return this.prisma.activity.update({ where: { id }, data });
  }

  async complete(orgId: string, id: string) {
    await this.get(orgId, id);
    return this.prisma.activity.update({ where: { id }, data: { done: true } });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.activity.delete({ where: { id } });
  }
}
