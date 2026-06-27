import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send.dto';

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
    @Query('folder') folder?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.list(u.orgId, {
      dealId,
      personId,
      userId: mine ? u.userId : undefined,
      folder,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Post('send')
  @Scopes('deals:write')
  send(@CurrentUser() u: AuthContext, @Body() dto: SendMessageDto) {
    return this.svc.send(u.orgId, u.userId, dto);
  }

  @Post(':id/read')
  @Scopes('deals:read')
  markRead(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.markRead(u.orgId, id);
  }

  @Post(':id/trash')
  @Scopes('deals:write')
  trash(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.trash(u.orgId, id);
  }

  /** The user's BCC / inbound-parse capture address (FR-5.8). Defined before `:id` so it isn't shadowed. */
  @Get('capture-address')
  @Scopes('deals:read')
  captureAddress(@CurrentUser() u: AuthContext) {
    return this.svc.getCaptureAddress(u.userId);
  }

  /** Folder counts for the current user's mailbox (Inbox/Sent/Trash/Spam tabs). */
  @Get('folder-counts')
  @Scopes('deals:read')
  folderCounts(@CurrentUser() u: AuthContext) {
    return this.svc.folderCounts(u.orgId, u.userId);
  }

  /** Full body, fetched on demand from Gmail. */
  @Get(':id/body')
  @Scopes('deals:read')
  body(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.body(u.orgId, id);
  }

  @Get(':id')
  @Scopes('deals:read')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }
}
