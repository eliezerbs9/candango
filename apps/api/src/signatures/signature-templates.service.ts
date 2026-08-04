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
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signatureTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
