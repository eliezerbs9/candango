import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';
import { DEFAULT_TEMPLATES, buildTemplateContext, renderTemplate } from './template-vars';

const shape = (t: {
  id: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat: string;
  tags: string[];
  updatedAt: Date;
}) => ({
  id: t.id,
  name: t.name,
  subject: t.subject,
  body: t.body,
  bodyFormat: t.bodyFormat,
  tags: t.tags,
  updatedAt: t.updatedAt.toISOString(),
});

const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20) : undefined;

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active templates for this tenant (used by the settings UI + send/automation flows). */
  async list(orgId: string) {
    const rows = await this.prisma.emailTemplate.findMany({
      where: { orgId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.emailTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!row) throw new NotFoundException('Template not found');
    return shape(row);
  }

  async create(orgId: string, userId: string, dto: CreateEmailTemplateDto) {
    const row = await this.prisma.emailTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        subject: dto.subject,
        body: dto.body,
        bodyFormat: dto.bodyFormat ?? 'richtext',
        tags: cleanTags(dto.tags) ?? [],
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateEmailTemplateDto) {
    const existing = await this.prisma.emailTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Template not found');
    const row = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.bodyFormat !== undefined ? { bodyFormat: dto.bodyFormat } : {}),
        ...(dto.tags !== undefined ? { tags: cleanTags(dto.tags) } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.emailTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.emailTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /**
   * Resolve a template's subject + body against a deal's context (contact/company/deal) plus the
   * current sender + workspace — used to pre-fill the send composer. `dealId` is optional
   * (without it, deal/contact/company variables resolve to empty).
   */
  async renderForDeal(orgId: string, userId: string, id: string, dealId?: string) {
    const t = await this.get(orgId, id);
    const deal = dealId
      ? await this.prisma.deal.findFirst({
          where: { id: dealId, orgId },
          select: {
            title: true,
            value: true,
            currency: true,
            primaryPerson: { select: { firstName: true, lastName: true, name: true, emails: true, phones: true } },
            company: { select: { name: true } },
          },
        })
      : null;
    const [user, org] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, orgId }, select: { name: true, email: true, phone: true } }),
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true } }),
    ]);
    const ctx = buildTemplateContext({
      person: deal?.primaryPerson ?? null,
      company: deal?.company ?? null,
      deal: deal ? { title: deal.title, value: deal.value, currency: deal.currency } : null,
      sender: user,
      workspace: org,
    });
    return { subject: renderTemplate(t.subject, ctx), body: renderTemplate(t.body, ctx) };
  }

  /**
   * Create any of the starter templates this org is missing (matched by name). Idempotent —
   * safe to call more than once. Used to backfill existing workspaces (new ones are seeded at signup).
   */
  async seedDefaults(orgId: string, userId?: string) {
    const existing = await this.prisma.emailTemplate.findMany({
      where: { orgId, archivedAt: null },
      select: { name: true },
    });
    const have = new Set(existing.map((t) => t.name));
    const missing = DEFAULT_TEMPLATES.filter((t) => !have.has(t.name));
    if (missing.length > 0) {
      await this.prisma.emailTemplate.createMany({
        data: missing.map((t) => ({ orgId, createdByUserId: userId ?? null, name: t.name, subject: t.subject, body: t.body })),
      });
    }
    return this.list(orgId);
  }
}
