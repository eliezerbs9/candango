import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { DealEventsService } from './deal-events.service';

@UseGuards(ApiAuthGuard)
@Controller('deals')
export class DealEventsController {
  constructor(private readonly svc: DealEventsService) {}

  /** System/automation events on the deal (automations, proposal responses, signature lifecycle). */
  @Get(':id/events')
  @Scopes('deals:read')
  list(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.list(u.orgId, id);
  }
}
