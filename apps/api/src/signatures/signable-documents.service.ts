import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignableDocumentDto, UpdateSignableDocumentDto } from './dto/signable-document.dto';

const shape = (r: { id: string; name: string; bodyHtml: string; createdAt: Date; updatedAt: Date }) => ({
  id: r.id,
  name: r.name,
  bodyHtml: r.bodyHtml,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

@Injectable()
export class SignableDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.signableDocumentTemplate.findMany({ where: { orgId, archivedAt: null }, orderBy: { createdAt: 'asc' } });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.signableDocumentTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!row) throw new NotFoundException('Document template not found');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateSignableDocumentDto) {
    const row = await this.prisma.signableDocumentTemplate.create({
      data: { orgId, createdByUserId: userId, name: dto.name.trim(), bodyHtml: dto.bodyHtml ?? '' },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateSignableDocumentDto) {
    await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signableDocumentTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
