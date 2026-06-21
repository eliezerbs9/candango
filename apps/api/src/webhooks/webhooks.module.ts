import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookEventsListener } from './webhook-events.listener';

// The delivery worker (WebhookDeliveryProcessor) lives in apps/workers and
// consumes this same queue. The API only enqueues (listener + ping/replay).
@Module({
  imports: [BullModule.registerQueue({ name: 'webhook-delivery' })],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookEventsListener],
})
export class WebhooksModule {}
