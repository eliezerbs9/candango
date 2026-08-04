import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { SignatureTemplatesService } from './signature-templates.service';
import { CreateSignatureTemplateDto, UpdateSignatureTemplateDto } from './dto/signature-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('signature-templates')
export class SignatureTemplatesController {
  constructor(private readonly svc: SignatureTemplatesService) {}

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateSignatureTemplateDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateSignatureTemplateDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
