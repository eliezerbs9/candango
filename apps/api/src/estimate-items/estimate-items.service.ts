import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateItemDto, UpdateEstimateItemDto } from './dto/estimate-item.dto';

const shape = (i: {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number | null;
}) => ({ id: i.id, name: i.name, description: i.description, unitPrice: i.unitPrice });

@Injectable()
export class EstimateItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active catalog items for this tenant (used by the estimate editor + settings). */
  async list(orgId: string) {
    const rows = await this.prisma.estimateItem.findMany({
      where: { orgId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(shape);
  }

  async create(orgId: string, dto: CreateEstimateItemDto) {
    const row = await this.prisma.estimateItem.create({
      data: { orgId, name: dto.name.trim(), description: dto.description ?? null, unitPrice: dto.unitPrice ?? null },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateEstimateItemDto) {
    const existing = await this.prisma.estimateItem.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Item not found');
    const row = await this.prisma.estimateItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.estimateItem.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Item not found');
    await this.prisma.estimateItem.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
