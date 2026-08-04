import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignableDocumentDto, UpdateSignableDocumentDto } from './dto/signable-document.dto';

const shape = (r: {
  id: string;
  name: string;
  mode: string;
  parties: string;
  party2Source: string;
  party2UserId: string | null;
  bodyHtml: string;
  layout: unknown;
  theme: unknown;
  fileKey: string | null;
  fields: unknown;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  name: r.name,
  mode: r.mode,
  parties: r.parties,
  party2Source: r.party2Source,
  party2UserId: r.party2UserId,
  bodyHtml: r.bodyHtml,
  layout: (r.layout as unknown[] | null) ?? [],
  theme: (r.theme as Record<string, unknown> | null) ?? {},
  fileKey: r.fileKey,
  fields: (r.fields as unknown[] | null) ?? [],
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

  async getOne(orgId: string, id: string) {
    return shape(await this.get(orgId, id));
  }

  async create(orgId: string, userId: string, dto: CreateSignableDocumentDto) {
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        mode: dto.mode ?? 'html',
        parties: dto.parties ?? 'one',
        party2Source: dto.party2Source ?? 'owner',
        party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null,
        bodyHtml: dto.bodyHtml ?? '',
        layout: (dto.layout ?? []) as object,
        theme: (dto.theme ?? {}) as object,
        fileKey: dto.fileKey ?? null,
        fields: (dto.fields ?? []) as object,
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateSignableDocumentDto) {
    await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.parties !== undefined ? { parties: dto.parties } : {}),
        ...(dto.party2Source !== undefined ? { party2Source: dto.party2Source, party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null } : dto.party2UserId !== undefined ? { party2UserId: dto.party2UserId } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout as object } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as object } : {}),
        ...(dto.fileKey !== undefined ? { fileKey: dto.fileKey } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields as object } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signableDocumentTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
