import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailAutomationDto, UpdateEmailAutomationDto } from './dto/email-automation.dto';

const shape = (a: {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  config: Prisma.JsonValue;
  templateId: string;
  template?: { name: string } | null;
  updatedAt: Date;
}) => ({
  id: a.id,
  name: a.name,
  enabled: a.enabled,
  trigger: a.trigger,
  config: (a.config ?? {}) as Record<string, unknown>,
  templateId: a.templateId,
  templateName: a.template?.name ?? null,
  updatedAt: a.updatedAt.toISOString(),
});

@Injectable()
export class EmailAutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.emailAutomation.findMany({
      where: { orgId, archivedAt: null },
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shape);
  }

  /** A template must exist (and belong to this org) before an automation can reference it. */
  private async assertTemplate(orgId: string, templateId: string) {
    const t = await this.prisma.emailTemplate.findFirst({ where: { id: templateId, orgId, archivedAt: null } });
    if (!t) throw new BadRequestException('Template not found');
  }

  async create(orgId: string, userId: string, dto: CreateEmailAutomationDto) {
    await this.assertTemplate(orgId, dto.templateId);
    const row = await this.prisma.emailAutomation.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        trigger: dto.trigger,
        templateId: dto.templateId,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateEmailAutomationDto) {
    const existing = await this.prisma.emailAutomation.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Automation not found');
    if (dto.templateId) await this.assertTemplate(orgId, dto.templateId);
    const row = await this.prisma.emailAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.emailAutomation.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Automation not found');
    await this.prisma.emailAutomation.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
