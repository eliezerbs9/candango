import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/note.dto';

@UseGuards(ApiAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly svc: NotesService) {}

  @Get()
  @Scopes('deals:read')
  list(
    @CurrentUser() u: AuthContext,
    @Query('deal_id') dealId?: string,
    @Query('person_id') personId?: string,
  ) {
    return this.svc.list(u.orgId, { dealId, personId });
  }

  @Post()
  @Scopes('deals:write')
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateNoteDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Delete(':id')
  @Scopes('deals:write')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
