import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { SignaturesService } from './signatures.service';
import { CreateSignatureDto } from './dto/signature.dto';

@UseGuards(JwtAuthGuard)
@Controller('signatures')
export class SignaturesController {
  constructor(private readonly svc: SignaturesService) {}

  @Get()
  list(@CurrentUser() u: AuthContext, @Query('dealId') dealId: string) {
    return this.svc.list(u.orgId, dealId);
  }

  /** Send a document for signature (appends an acceptance page + DocuSeal submission). */
  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateSignatureDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  /** Short-lived signed URL to download the completed/signed PDF. */
  @Get(':id/signed-url')
  signedUrl(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.signedUrl(u.orgId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
