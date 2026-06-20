import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

interface DeliveryJob {
  webhookId: string;
  eventId: string;
  type: string;
  orgId: string;
  data: unknown;
}

/** Signs the payload (HMAC-SHA256), POSTs it, logs the attempt; throws to trigger BullMQ retries. */
@Processor('webhook-delivery')
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DeliveryJob>): Promise<void> {
    const { webhookId, eventId, type, orgId, data } = job.data;
    const webhook = await this.prisma.webhook.findFirst({ where: { id: webhookId, isActive: true } });
    if (!webhook) return; // deleted or deactivated since enqueue — drop silently

    const event = { id: eventId, type, created_at: new Date().toISOString(), org_id: orgId, data };
    const body = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', webhook.secret).update(`${ts}.${body}`).digest('hex');

    let responseCode = 0;
    let ok = false;
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Candango-Signature': `t=${ts},v1=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      responseCode = res.status;
      ok = res.ok;
    } catch {
      ok = false;
    }

    await this.prisma.webhookDelivery.create({
      data: {
        orgId,
        webhookId,
        eventId,
        status: ok ? 'success' : 'failed',
        attempt: job.attemptsMade + 1,
        responseCode: responseCode || null,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });

    if (!ok) throw new Error(`Webhook delivery failed (HTTP ${responseCode || 'no response'})`);
  }
}
