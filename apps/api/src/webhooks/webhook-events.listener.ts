import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface WebhookEvent {
  orgId: string;
  type: string;
  data: unknown;
}

/** Fans a domain event out to every active webhook subscribed to that type. */
@Injectable()
export class WebhookEventsListener {
  constructor(
    @InjectQueue('webhook-delivery') private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('webhook.event')
  async handle(evt: WebhookEvent) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { orgId: evt.orgId, isActive: true, eventTypes: { has: evt.type } },
      select: { id: true },
    });
    for (const wh of webhooks) {
      const eventId = `evt_${randomBytes(8).toString('hex')}`;
      await this.queue.add(
        'deliver',
        { webhookId: wh.id, eventId, type: evt.type, orgId: evt.orgId, data: evt.data },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      );
    }
  }
}
