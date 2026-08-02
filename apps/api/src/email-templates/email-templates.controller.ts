import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';
import { TEMPLATE_VARIABLES } from './template-vars';

@UseGuards(JwtAuthGuard)
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly svc: EmailTemplatesService) {}

  /** The variable catalog for the template editor palette (any member). */
  @Get('variables')
  variables() {
    return TEMPLATE_VARIABLES;
  }

  // Readable by any member (the send flow picks from these).
  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Get(':id')
  getOne(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  /** Render a template's subject + body for a deal (to pre-fill the send composer). */
  @Get(':id/render')
  render(@CurrentUser() u: AuthContext, @Param('id') id: string, @Query('dealId') dealId?: string) {
    return this.svc.renderForDeal(u.orgId, u.userId, id, dealId);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateEmailTemplateDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  /** Backfill this workspace's missing starter templates (idempotent). */
  @Post('seed-defaults')
  @UseGuards(AdminGuard)
  seedDefaults(@CurrentUser() u: AuthContext) {
    return this.svc.seedDefaults(u.orgId, u.userId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
