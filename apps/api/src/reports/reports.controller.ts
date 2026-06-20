import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';

@UseGuards(ApiAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('pipeline')
  @Scopes('reports:read')
  pipeline(@CurrentUser() u: AuthContext, @Query('pipeline_id') pipelineId?: string) {
    return this.svc.pipeline(u.orgId, pipelineId);
  }

  @Get('sales')
  @Scopes('reports:read')
  sales(@CurrentUser() u: AuthContext, @Query('group_by') _groupBy?: string) {
    return this.svc.byRep(u.orgId);
  }

  @Get('won-lost')
  @Scopes('reports:read')
  wonLost(@CurrentUser() u: AuthContext) {
    return this.svc.wonLost(u.orgId);
  }
}
