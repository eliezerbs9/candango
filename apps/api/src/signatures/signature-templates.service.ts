import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignatureTemplateDto, UpdateSignatureTemplateDto } from './dto/signature-template.dto';

const shape = (r: {
  id: string;
  name: string;
  initialsRule: string;
  initialsPages: unknown;
  acceptance: boolean;
  acceptanceText: string | null;
  fields: unknown;
  requireCounterSigner: boolean;
  parties: string;
  party2Source: string;
  party2UserId: string | null;
  initialsParty: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  name: r.name,
  initialsRule: r.initialsRule,
  initialsPages: (r.initialsPages as number[] | null) ?? [],
  acceptance: r.acceptance,
  acceptanceText: r.acceptanceText,
  fields: (r.fields as unknown[] | null) ?? [],
  requireCounterSigner: r.requireCounterSigner,
  parties: r.parties,
  party2Source: r.party2Source,
  party2UserId: r.party2UserId,
  initialsParty: r.initialsParty,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export type ShapedSignatureTemplate = ReturnType<typeof shape>;

@Injectable()
export class SignatureTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.signatureTemplate.findMany({ where: { orgId, archivedAt: null }, orderBy: { createdAt: 'asc' } });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.signatureTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!row) throw new NotFoundException('Signature template not found');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateSignatureTemplateDto) {
    const row = await this.prisma.signatureTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name,
        initialsRule: dto.initialsRule ?? 'none',
        initialsPages: dto.initialsPages ?? [],
        acceptance: dto.acceptance ?? true,
        acceptanceText: dto.acceptanceText ?? null,
        fields: (dto.fields ?? []) as object,
        requireCounterSigner: dto.requireCounterSigner ?? false,
        parties: dto.parties ?? 'one',
        party2Source: dto.party2Source ?? 'owner',
        party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null,
        initialsParty: dto.initialsParty ?? 'client',
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateSignatureTemplateDto) {
    await this.get(orgId, id);
    const row = await this.prisma.signatureTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.initialsRule !== undefined ? { initialsRule: dto.initialsRule } : {}),
        ...(dto.initialsPages !== undefined ? { initialsPages: dto.initialsPages } : {}),
        ...(dto.acceptance !== undefined ? { acceptance: dto.acceptance } : {}),
        ...(dto.acceptanceText !== undefined ? { acceptanceText: dto.acceptanceText } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields as object } : {}),
        ...(dto.requireCounterSigner !== undefined ? { requireCounterSigner: dto.requireCounterSigner } : {}),
        ...(dto.parties !== undefined ? { parties: dto.parties } : {}),
        ...(dto.party2Source !== undefined ? { party2Source: dto.party2Source, party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null } : dto.party2UserId !== undefined ? { party2UserId: dto.party2UserId } : {}),
        ...(dto.initialsParty !== undefined ? { initialsParty: dto.initialsParty } : {}),
      },
    });
    return shape(row);
  }

  /** Copy a signature template into a new "(copy)" — same rules, fields and party config. */
  async duplicate(orgId: string, userId: string, id: string) {
    const src = await this.get(orgId, id);
    const row = await this.prisma.signatureTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: `${src.name} (copy)`,
        initialsRule: src.initialsRule,
        initialsPages: src.initialsPages as object,
        acceptance: src.acceptance,
        acceptanceText: src.acceptanceText,
        fields: src.fields as object,
        requireCounterSigner: src.requireCounterSigner,
        parties: src.parties,
        party2Source: src.party2Source,
        party2UserId: src.party2UserId,
        initialsParty: src.initialsParty,
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signatureTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
