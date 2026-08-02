import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicEmailService } from './public-email.service';

/**
 * Public, unauthenticated endpoints backing the marketing unsubscribe page. Intentionally has NO
 * auth guard — access is gated by the unguessable per-person token in the URL.
 */
@Controller('public/email-preferences')
export class PublicEmailController {
  constructor(private readonly svc: PublicEmailService) {}

  @Get(':token')
  status(@Param('token') token: string) {
    return this.svc.status(token);
  }

  @Post(':token')
  update(@Param('token') token: string, @Body() body: { subscribed?: boolean }) {
    // Default action (from the one-click unsubscribe link) is to opt out.
    return this.svc.setSubscribed(token, body?.subscribed === true);
  }
}
