import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../../auth/api-auth.guard';
import { Scopes } from '../../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../../auth/current-user.decorator';
import { DealQuickbooksService } from './deal-quickbooks.service';
import {
  ConvertToInvoiceDto,
  CreateDocDto,
  IncludeInValueDto,
  IncludeInvoicesInValueDto,
  LinkQuickbooksDto,
  SendDocDto,
  UpdateDocStatusDto,
} from './dto/quickbooks.dto';

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

  @Get('quickbooks/link-status')
  @Scopes('deals:read')
  linkStatus(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.linkStatus(u.orgId, id);
  }

  @Get('quickbooks/items')
  @Scopes('deals:read')
  listItems(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listItems(u.orgId, id);
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

  @Patch('estimates/:eid')
  @Scopes('deals:write')
  updateEstimate(
    @CurrentUser() u: AuthContext,
    @Param('id') id: string,
    @Param('eid') eid: string,
    @Body() dto: CreateDocDto,
  ) {
    return this.svc.updateEstimate(u.orgId, id, eid, dto);
  }

  @Post('estimates/include-in-value')
  @Scopes('deals:write')
  includeEstimatesInValue(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: IncludeInValueDto) {
    return this.svc.includeEstimatesInValue(u.orgId, id, dto.estimateIds, dto.include);
  }

  @Post('estimates/:eid/send')
  @Scopes('deals:write')
  sendEstimate(@CurrentUser() u: AuthContext, @Param('id') id: string, @Param('eid') eid: string, @Body() dto: SendDocDto) {
    return this.svc.sendEstimate(u.orgId, id, eid, dto.email);
  }

  // --- Invoices ---
  @Get('invoices')
  @Scopes('deals:read')
  listInvoices(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listInvoices(u.orgId, id);
  }

  // Invoices are created only by converting one or more estimates (never directly).
  @Post('invoices/from-estimates')
  @Scopes('deals:write')
  createInvoiceFromEstimates(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: ConvertToInvoiceDto) {
    return this.svc.createInvoiceFromEstimates(u.orgId, id, dto);
  }

  @Patch('invoices/:invid')
  @Scopes('deals:write')
  updateInvoice(
    @CurrentUser() u: AuthContext,
    @Param('id') id: string,
    @Param('invid') invid: string,
    @Body() dto: CreateDocDto,
  ) {
    return this.svc.updateInvoice(u.orgId, id, invid, dto);
  }

  @Post('invoices/include-in-value')
  @Scopes('deals:write')
  includeInvoicesInValue(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: IncludeInvoicesInValueDto) {
    return this.svc.includeInvoicesInValue(u.orgId, id, dto.invoiceIds, dto.include);
  }

  @Post('invoices/:invid/send')
  @Scopes('deals:write')
  sendInvoice(@CurrentUser() u: AuthContext, @Param('id') id: string, @Param('invid') invid: string, @Body() dto: SendDocDto) {
    return this.svc.sendInvoice(u.orgId, id, invid, dto.email);
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
