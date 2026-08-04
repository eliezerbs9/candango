import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SignaturesService } from './signatures.service';

/** Unauthenticated DocuSeal webhook receiver. Correlated by submission id; RLS is bypassed (no tenant). */
@Controller('public/docuseal')
export class SignatureWebhookController {
  constructor(private readonly svc: SignaturesService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: unknown) {
    await this.svc.handleWebhook(payload);
    return { ok: true };
  }
}
