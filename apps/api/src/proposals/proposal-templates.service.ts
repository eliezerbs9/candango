import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalTemplateDto, UpdateProposalTemplateDto } from './dto/proposal-template.dto';
import { DEFAULT_THEME, STARTER_TEMPLATES } from './proposal-blocks';

const shape = (t: {
  id: string;
  name: string;
  theme: Prisma.JsonValue;
  layout: Prisma.JsonValue;
  emailTemplateId: string | null;
  systemKey: string | null;
  updatedAt: Date;
}) => ({
  id: t.id,
  name: t.name,
  theme: (t.theme ?? {}) as Record<string, unknown>,
  layout: (t.layout ?? []) as unknown[],
  emailTemplateId: t.emailTemplateId,
  systemKey: t.systemKey,
  system: t.systemKey != null,
  updatedAt: t.updatedAt.toISOString(),
});

@Injectable()
export class ProposalTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.proposalTemplate.findMany({
      where: { orgId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.proposalTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!row) throw new NotFoundException('Proposal template not found');
    return shape(row);
  }

  async create(orgId: string, userId: string, dto: CreateProposalTemplateDto) {
    const row = await this.prisma.proposalTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        theme: (dto.theme ?? DEFAULT_THEME) as Prisma.InputJsonValue,
        layout: (dto.layout ?? []) as Prisma.InputJsonValue,
        emailTemplateId: dto.emailTemplateId ?? null,
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateProposalTemplateDto) {
    await this.get(orgId, id);
    const row = await this.prisma.proposalTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as Prisma.InputJsonValue } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout as Prisma.InputJsonValue } : {}),
        ...(dto.emailTemplateId !== undefined ? { emailTemplateId: dto.emailTemplateId || null } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.proposalTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Proposal template not found');
    if (existing.systemKey) {
      throw new BadRequestException('This is a starter template and can’t be deleted — you can edit it instead.');
    }
    await this.prisma.proposalTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Seed any missing starter templates (matched by systemKey). Idempotent. */
  async seedDefaults(orgId: string, userId?: string) {
    const existing = await this.prisma.proposalTemplate.findMany({
      where: { orgId, archivedAt: null },
      select: { systemKey: true },
    });
    const have = new Set(existing.map((t) => t.systemKey).filter(Boolean));
    const missing = STARTER_TEMPLATES.filter((t) => !have.has(t.systemKey));
    if (missing.length > 0) {
      await this.prisma.proposalTemplate.createMany({
        data: missing.map((t) => ({
          orgId,
          createdByUserId: userId ?? null,
          systemKey: t.systemKey,
          name: t.name,
          theme: t.theme as unknown as Prisma.InputJsonValue,
          layout: t.layout as unknown as Prisma.InputJsonValue,
        })),
      });
    }
    return this.list(orgId);
  }
}
