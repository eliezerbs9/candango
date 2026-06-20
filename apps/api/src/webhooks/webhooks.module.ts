import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookEventsListener } from './webhook-events.listener';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'webhook-delivery' })],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookEventsListener, WebhookDeliveryProcessor],
})
export class WebhooksModule {}
