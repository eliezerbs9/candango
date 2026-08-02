import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { EmailAutomationsService } from './email-automations.service';
import { CreateEmailAutomationDto, UpdateEmailAutomationDto } from './dto/email-automation.dto';
import { AUTOMATION_TRIGGERS } from './triggers';
import { AUTOMATION_CATEGORIES } from './automation-categories';

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
