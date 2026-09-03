import { Controller, ForbiddenException, Headers, HttpCode, Logger, Post, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { SignaturesService } from './signatures.service';

/**
 * Unauthenticated Documenso webhook receiver. Correlated by document id; RLS is bypassed (no tenant).
 *
 * Documenso does not HMAC-sign the body (unlike Intuit/Stripe) — it echoes the webhook's configured
 * secret verbatim in the `X-Documenso-Secret` header. So the check is a constant-time comparison of
 * that header against `DOCUMENSO_WEBHOOK_SECRET`.
 *
 * **Fails closed:** with no secret configured every call is rejected. That is safe because document
 * status also self-heals through `reconcile()` (see SignaturesService.list) — the webhook is an
 * accelerator, not the only path. Accepting unsigned calls would let anyone mark a document `signed`
 * (an immutable record that can never be deleted) by guessing a sequential Documenso document id.
 */
@Controller('public/documenso')
export class SignatureWebhookController {
  private readonly logger = new Logger(SignatureWebhookController.name);

  constructor(
    private readonly svc: SignaturesService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: unknown, @Headers('x-documenso-secret') secret?: string) {
    const expected = this.config.get<string>('DOCUMENSO_WEBHOOK_SECRET');
    if (!expected) {
      this.logger.warn('Rejected a Documenso webhook: DOCUMENSO_WEBHOOK_SECRET is not configured.');
      throw new ForbiddenException('Webhook verification is not configured');
    }
    if (!this.verify(secret, expected)) throw new ForbiddenException('Invalid Documenso webhook secret');

    await this.svc.handleWebhook(payload);
    return { ok: true };
  }

  /** Constant-time compare. Both sides are hashed first so the digests are always the same length. */
  private verify(received: string | undefined, expected: string): boolean {
    if (!received) return false;
    const a = createHash('sha256').update(received).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
  }
}
