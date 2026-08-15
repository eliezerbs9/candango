import { BadRequestException, Controller, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { DealQuickbooksService, type QboWebhookPayload } from './deal-quickbooks.service';

/**
 * Public (no auth) — Intuit/QuickBooks calls this whenever an entity changes in a connected
 * company, so a change made directly in QuickBooks (edit / void / delete / payment) is reflected
 * back here. The raw body is HMAC-SHA256 signed with the app's Webhook **Verifier Token**
 * (`intuit-signature` header, base64). We verify, respond 200 fast, and reconcile in the
 * background (Intuit retries on any non-200).
 */
@Controller('public/quickbooks')
export class QuickbooksWebhookController {
  constructor(
    private readonly svc: DealQuickbooksService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('intuit-signature') signature?: string) {
    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing webhook body');
    const token = this.config.get<string>('QBO_WEBHOOK_VERIFIER_TOKEN');
    if (!token || !this.verify(raw, signature, token)) {
      throw new BadRequestException('Invalid QuickBooks webhook signature');
    }
    let payload: QboWebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as QboWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
    // Fire-and-forget: acknowledge immediately, reconcile async (best-effort).
    void this.svc.handleQboWebhook(payload).catch(() => undefined);
    return { ok: true };
  }

  private verify(raw: Buffer, signature: string | undefined, token: string): boolean {
    if (!signature) return false;
    const expected = createHmac('sha256', token).update(raw).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
