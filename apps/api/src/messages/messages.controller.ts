import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { MessagesService } from './messages.service';

@UseGuards(ApiAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly svc: MessagesService) {}

  @Get()
  @Scopes('deals:read')
  list(
    @CurrentUser() u: AuthContext,
    @Query('deal_id') dealId?: string,
    @Query('person_id') personId?: string,
    @Query('mine') mine?: string,
  ) {
    // `mine=1` scopes to the caller's own mailbox (used by the Email screen).
    return this.svc.list(u.orgId, { dealId, personId, userId: mine ? u.userId : undefined });
  }
}
