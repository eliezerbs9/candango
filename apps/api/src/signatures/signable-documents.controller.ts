import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { SignableDocumentsService } from './signable-documents.service';
import { CreateSignableDocumentDto, UpdateSignableDocumentDto } from './dto/signable-document.dto';

@UseGuards(JwtAuthGuard)
@Controller('signable-documents')
export class SignableDocumentsController {
  constructor(private readonly svc: SignableDocumentsService) {}

  @Get()
  list(@CurrentUser() u: AuthContext, @Query('dealId') dealId?: string) {
    return dealId ? this.svc.listForDeal(u.orgId, dealId) : this.svc.list(u.orgId);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.getOne(u.orgId, id);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateSignableDocumentDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateSignableDocumentDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.duplicate(u.orgId, u.userId, id);
  }

  @Post(':id/for-deal')
  forDeal(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() body: { dealId: string }) {
    return this.svc.duplicateForDeal(u.orgId, u.userId, id, body.dealId);
  }

  /** Duplicate a deal document (draft, or a sent request's pre-PDF source) into a new deal draft. */
  @Post(':id/duplicate-in-deal')
  duplicateInDeal(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.duplicateDealDoc(u.orgId, u.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id, u.role);
  }
}
