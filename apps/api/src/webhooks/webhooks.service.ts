import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

const SELECT = {
  id: true,
  url: true,
  eventTypes: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.webhook.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  }

  /** Generates the signing secret, returns it ONCE (used for HMAC payload signatures). */
  async create(orgId: string, createdBy: string, dto: CreateWebhookDto) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.webhook.create({
      data: { orgId, url: dto.url, eventTypes: dto.eventTypes, secret, createdBy },
      select: SELECT,
    });
    return { ...row, secret };
  }

  async update(orgId: string, id: string, dto: UpdateWebhookDto) {
    await this.ensure(orgId, id);
    return this.prisma.webhook.update({
      where: { id },
      data: { isActive: dto.isActive, eventTypes: dto.eventTypes },
      select: SELECT,
    });
  }

  async remove(orgId: string, id: string) {
    await this.ensure(orgId, id);
    await this.prisma.webhook.delete({ where: { id } });
  }

  private async ensure(orgId: string, id: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, orgId } });
    if (!wh) throw new NotFoundException('Webhook not found');
    return wh;
  }
}
