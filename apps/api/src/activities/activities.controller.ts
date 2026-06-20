import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

@UseGuards(ApiAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Get()
  @Scopes('deals:read')
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post()
  @Scopes('deals:write')
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateActivityDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Patch(':id')
  @Scopes('deals:write')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Post(':id/complete')
  @Scopes('deals:write')
  complete(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.complete(u.orgId, id);
  }

  @Delete(':id')
  @Scopes('deals:write')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
