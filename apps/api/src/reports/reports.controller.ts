import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('pipeline')
  pipeline(@CurrentUser() u: AuthContext, @Query('pipeline_id') pipelineId?: string) {
    return this.svc.pipeline(u.orgId, pipelineId);
  }

  @Get('sales')
  sales(@CurrentUser() u: AuthContext, @Query('group_by') groupBy?: string) {
    // group_by=rep (default). 'stage' is covered by /reports/pipeline.
    return this.svc.byRep(u.orgId);
  }

  @Get('won-lost')
  wonLost(@CurrentUser() u: AuthContext) {
    return this.svc.wonLost(u.orgId);
  }
}
