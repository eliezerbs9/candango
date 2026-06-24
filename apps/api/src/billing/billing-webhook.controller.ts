import { BadRequestException, Controller, Headers, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';

// Public (no auth) — Stripe calls this. Signature is verified against the raw body.
@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly svc: BillingService) {}

  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) throw new BadRequestException('Missing webhook body');
    return this.svc.handleWebhook(req.rawBody, signature);
  }
}
