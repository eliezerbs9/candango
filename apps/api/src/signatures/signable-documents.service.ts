import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignableDocumentDto, UpdateSignableDocumentDto } from './dto/signable-document.dto';

const shape = (r: {
  id: string;
  dealId: string | null;
  name: string;
  mode: string;
  parties: string;
  party2Source: string;
  party2UserId: string | null;
  initialsRule: string;
  initialsPages: unknown;
  initialsParty: string;
  bodyHtml: string;
  layout: unknown;
  theme: unknown;
  fileKey: string | null;
  fields: unknown;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  dealId: r.dealId,
  name: r.name,
  mode: r.mode,
  parties: r.parties,
  party2Source: r.party2Source,
  party2UserId: r.party2UserId,
  initialsRule: r.initialsRule,
  initialsPages: (r.initialsPages as number[] | null) ?? [],
  initialsParty: r.initialsParty,
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

  /** Reusable templates only — one-off deal documents (dealId set) are excluded. */
  async list(orgId: string) {
    const rows = await this.prisma.signableDocumentTemplate.findMany({ where: { orgId, dealId: null, archivedAt: null }, orderBy: { createdAt: 'asc' } });
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
        dealId: dto.dealId ?? null,
        name: dto.name.trim(),
        mode: dto.mode ?? 'html',
        parties: dto.parties ?? 'one',
        party2Source: dto.party2Source ?? 'owner',
        party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null,
        initialsRule: dto.initialsRule ?? 'none',
        initialsPages: dto.initialsPages ?? [],
        initialsParty: dto.initialsParty ?? 'client',
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
        ...(dto.initialsRule !== undefined ? { initialsRule: dto.initialsRule } : {}),
        ...(dto.initialsPages !== undefined ? { initialsPages: dto.initialsPages } : {}),
        ...(dto.initialsParty !== undefined ? { initialsParty: dto.initialsParty } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout as object } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as object } : {}),
        ...(dto.fileKey !== undefined ? { fileKey: dto.fileKey } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields as object } : {}),
      },
    });
    return shape(row);
  }

  /** Copy a template into a new "(copy)" — same content, parties, fields and options. */
  async duplicate(orgId: string, userId: string, id: string) {
    const src = await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: `${src.name} (copy)`,
        mode: src.mode,
        parties: src.parties,
        party2Source: src.party2Source,
        party2UserId: src.party2UserId,
        initialsRule: src.initialsRule,
        initialsPages: src.initialsPages as object,
        initialsParty: src.initialsParty,
        bodyHtml: src.bodyHtml,
        layout: src.layout as object,
        theme: src.theme as object,
        fileKey: src.fileKey,
        fields: src.fields as object,
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signableDocumentTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
