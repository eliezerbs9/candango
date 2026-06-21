import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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

const JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: 200,
  removeOnFail: 1000,
};

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-delivery') private readonly queue: Queue,
  ) {}

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

  // --- Deliveries ---

  async listDeliveries(orgId: string, webhookId: string) {
    await this.ensure(orgId, webhookId);
    return this.prisma.webhookDelivery.findMany({
      where: { orgId, webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, eventId: true, status: true, attempt: true, responseCode: true, createdAt: true, payload: true },
    });
  }

  /** Send a one-off test event to this webhook (bypasses subscription matching). */
  async ping(orgId: string, webhookId: string) {
    await this.ensure(orgId, webhookId);
    await this.enqueue(webhookId, orgId, 'ping', { message: 'Test event from Candango' });
    return { ok: true };
  }

  /** Re-enqueue a previous delivery's payload to the same webhook. */
  async replay(orgId: string, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({ where: { id: deliveryId, orgId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const payload = (delivery.payload ?? {}) as { type?: string; data?: unknown };
    await this.enqueue(delivery.webhookId, orgId, payload.type ?? 'replay', payload.data ?? {});
    return { ok: true };
  }

  private enqueue(webhookId: string, orgId: string, type: string, data: unknown) {
    const eventId = `evt_${randomBytes(8).toString('hex')}`;
    return this.queue.add('deliver', { webhookId, eventId, type, orgId, data }, JOB_OPTS);
  }

  private async ensure(orgId: string, id: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, orgId } });
    if (!wh) throw new NotFoundException('Webhook not found');
    return wh;
  }
}
