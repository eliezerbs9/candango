import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { DealsService } from './deals.service';
import { CreateDealDto, LoseDealDto, UpdateDealDto } from './dto/deal.dto';

@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly svc: DealsService) {}

  @Get()
  list(
    @CurrentUser() u: AuthContext,
    @Query('pipeline_id') pipelineId?: string,
    @Query('stage_id') stageId?: string,
    @Query('status') status?: string,
    @Query('owner_user_id') ownerUserId?: string,
  ) {
    return this.svc.list(u.orgId, { pipelineId, stageId, status, ownerUserId });
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateDealDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }

  @Post(':id/win')
  win(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.win(u.orgId, id);
  }

  @Post(':id/lose')
  lose(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: LoseDealDto) {
    return this.svc.lose(u.orgId, id, dto.lostReason);
  }
}
