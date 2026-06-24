import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../../auth/api-auth.guard';
import { Scopes } from '../../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../../auth/current-user.decorator';
import { DealQuickbooksService } from './deal-quickbooks.service';
import { CreateDocDto, LinkQuickbooksDto, UpdateDocStatusDto } from './dto/quickbooks.dto';

@UseGuards(ApiAuthGuard)
@Controller('deals/:id')
export class DealQuickbooksController {
  constructor(private readonly svc: DealQuickbooksService) {}

  // --- Account linking ---
  @Post('quickbooks/link')
  @Scopes('deals:write')
  link(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: LinkQuickbooksDto) {
    return this.svc.link(u.orgId, id, dto);
  }

  @Get('quickbooks/parent-search')
  @Scopes('deals:read')
  parentSearch(@CurrentUser() u: AuthContext, @Param('id') id: string, @Query('q') q = '') {
    return this.svc.searchParents(u.orgId, id, q);
  }

  // --- Estimates ---
  @Get('estimates')
  @Scopes('deals:read')
  listEstimates(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listEstimates(u.orgId, id);
  }

  @Post('estimates')
  @Scopes('deals:write')
  createEstimate(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: CreateDocDto) {
    return this.svc.createEstimate(u.orgId, id, dto);
  }

  @Patch('estimates/:eid/status')
  @Scopes('deals:write')
  setEstimateStatus(
    @CurrentUser() u: AuthContext,
    @Param('id') id: string,
    @Param('eid') eid: string,
    @Body() dto: UpdateDocStatusDto,
  ) {
    return this.svc.setEstimateStatus(u.orgId, id, eid, dto.status);
  }

  // --- Invoices ---
  @Get('invoices')
  @Scopes('deals:read')
  listInvoices(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listInvoices(u.orgId, id);
  }

  @Post('invoices')
  @Scopes('deals:write')
  createInvoice(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: CreateDocDto) {
    return this.svc.createInvoice(u.orgId, id, dto);
  }

  @Patch('invoices/:invid/status')
  @Scopes('deals:write')
  setInvoiceStatus(
    @CurrentUser() u: AuthContext,
    @Param('id') id: string,
    @Param('invid') invid: string,
    @Body() dto: UpdateDocStatusDto,
  ) {
    return this.svc.setInvoiceStatus(u.orgId, id, invid, dto.status);
  }
}
