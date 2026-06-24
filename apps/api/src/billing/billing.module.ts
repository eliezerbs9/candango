import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingService } from './billing.service';
import { LockGuard } from './lock.guard';
import { StripeService } from './stripe.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, StripeService, { provide: APP_GUARD, useClass: LockGuard }],
  exports: [BillingService, StripeService],
})
export class BillingModule {}
