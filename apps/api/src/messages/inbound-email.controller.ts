import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { InboundEmailService } from './inbound-email.service';

/**
 * Public (unauthenticated) inbound-email webhook for the BCC / inbound-parse capture model (FR-5.8).
 * The provider (Brevo Inbound / Mailgun / etc.) POSTs a parsed email here; we authenticate it with
 * a shared secret passed as the `x-inbound-secret` header or a `?secret=` query param.
 */
@Controller('email')
export class InboundEmailController {
  constructor(private readonly svc: InboundEmailService) {}

  @Post('inbound')
  @HttpCode(200) // always 200 on accepted/ignored so providers don't retry; bad secret still 401
  inbound(
    @Body() body: unknown,
    @Headers('x-inbound-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
  ) {
    return this.svc.handle(body, headerSecret ?? querySecret);
  }
}
