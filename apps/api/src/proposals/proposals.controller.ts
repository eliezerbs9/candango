import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto, UpdateProposalDto } from './dto/proposal.dto';

@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly svc: ProposalsService) {}

  @Get()
  list(@CurrentUser() u: AuthContext, @Query('dealId') dealId: string) {
    return this.svc.list(u.orgId, dealId);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  /** Resolved render data (variables + signed image/doc URLs + pricing) for drawing the proposal. */
  @Get(':id/render')
  render(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.render(u.orgId, id);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateProposalDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateProposalDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
