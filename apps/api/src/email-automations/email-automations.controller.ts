import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { EmailAutomationsService } from './email-automations.service';
import {
  CreateEmailAutomationDto,
  CreateMarketingAutomationDto,
  UpdateEmailAutomationDto,
  UpdateMarketingAutomationDto,
} from './dto/email-automation.dto';
import { AUTOMATION_TRIGGERS } from './triggers';
import { AUTOMATION_CATEGORIES } from './automation-categories';
import type { MarketingAudience } from './marketing-audience';

@UseGuards(JwtAuthGuard)
@Controller('email-automations')
export class EmailAutomationsController {
  constructor(private readonly svc: EmailAutomationsService) {}

  /** The trigger catalog for the automations UI. */
  @Get('triggers')
  triggers() {
    return AUTOMATION_TRIGGERS;
  }

  /** The system-defined category list (users pick one but cannot add categories). */
  @Get('categories')
  categories() {
    return AUTOMATION_CATEGORIES;
  }

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateEmailAutomationDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  // ── Marketing automations ──
  @Post('marketing')
  @UseGuards(AdminGuard)
  createMarketing(@CurrentUser() u: AuthContext, @Body() dto: CreateMarketingAutomationDto) {
    return this.svc.createMarketing(u.orgId, u.userId, dto);
  }

  @Patch('marketing/:id')
  @UseGuards(AdminGuard)
  updateMarketing(
    @CurrentUser() u: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateMarketingAutomationDto,
  ) {
    return this.svc.updateMarketing(u.orgId, id, dto);
  }

  /** How many contacts an audience currently resolves to (for the marketing builder). */
  @Post('marketing/audience-preview')
  async audiencePreview(@CurrentUser() u: AuthContext, @Body() body: { audience: MarketingAudience }) {
    const people = await this.svc.resolveAudience(u.orgId, body.audience);
    return { count: people.length };
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateEmailAutomationDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
