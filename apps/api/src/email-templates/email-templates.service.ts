import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

const shape = (t: { id: string; name: string; subject: string; body: string; updatedAt: Date }) => ({
  id: t.id,
  name: t.name,
  subject: t.subject,
  body: t.body,
  updatedAt: t.updatedAt.toISOString(),
});

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
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.emailTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.emailTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
