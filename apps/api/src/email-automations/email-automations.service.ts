import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailAutomationDto, UpdateEmailAutomationDto } from './dto/email-automation.dto';

const shape = (a: {
  id: string;
  name: string;
  enabled: boolean;
  category: string;
  tags: string[];
  trigger: string;
  action: string;
  config: Prisma.JsonValue;
  templateId: string | null;
  template?: { name: string } | null;
  updatedAt: Date;
}) => ({
  id: a.id,
  name: a.name,
  enabled: a.enabled,
  category: a.category,
  tags: a.tags,
  trigger: a.trigger,
  action: a.action,
  config: (a.config ?? {}) as Record<string, unknown>,
  templateId: a.templateId,
  templateName: a.template?.name ?? null,
  updatedAt: a.updatedAt.toISOString(),
});

const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20) : undefined;

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

  /**
   * The send_email action needs a template that belongs to this org AND is deal-scoped — these
   * automations run in the context of one deal, so a marketing template (no deal/sender variables)
   * could never render correctly here.
   */
  private async validateAction(orgId: string, action: string, templateId?: string | null) {
    if (action === 'send_email') {
      if (!templateId) throw new BadRequestException('Pick a template for the email action');
      const t = await this.prisma.emailTemplate.findFirst({ where: { id: templateId, orgId, archivedAt: null } });
      if (!t) throw new BadRequestException('Template not found');
      if (t.scope !== 'deal') {
        throw new BadRequestException('Pick a deal email template — marketing templates can’t be used in deal automations');
      }
    }
  }

  /** Email automations can only be enabled when the workspace has at least one connected mailbox. */
  private async orgHasMailbox(orgId: string) {
    return (await this.prisma.mailboxConnection.count({ where: { orgId } })) > 0;
  }

  async create(orgId: string, userId: string, dto: CreateEmailAutomationDto) {
    await this.validateAction(orgId, dto.action, dto.templateId);
    // An email automation can be created without Google, but starts OFF until a mailbox is connected.
    let enabled = dto.enabled ?? true;
    if (dto.action === 'send_email' && enabled && !(await this.orgHasMailbox(orgId))) enabled = false;
    const row = await this.prisma.emailAutomation.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        category: dto.category ?? 'general',
        tags: cleanTags(dto.tags) ?? [],
        trigger: dto.trigger,
        action: dto.action,
        templateId: dto.action === 'send_email' ? dto.templateId : null,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        enabled,
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateEmailAutomationDto) {
    const existing = await this.prisma.emailAutomation.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Automation not found');
    const action = dto.action ?? existing.action;
    const templateId = dto.templateId !== undefined ? dto.templateId : existing.templateId;
    if (dto.action !== undefined || dto.templateId !== undefined) await this.validateAction(orgId, action, templateId);
    // Block turning ON an email automation until the workspace has a connected mailbox.
    const willEnable = dto.enabled !== undefined ? dto.enabled : existing.enabled;
    if (action === 'send_email' && willEnable && !(await this.orgHasMailbox(orgId))) {
      throw new BadRequestException('Connect Google (Gmail) before enabling email automations');
    }
    const row = await this.prisma.emailAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.tags !== undefined ? { tags: cleanTags(dto.tags) } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.action !== undefined ? { action: dto.action } : {}),
        ...(dto.action !== undefined || dto.templateId !== undefined
          ? { templateId: action === 'send_email' ? templateId : null }
          : {}),
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
