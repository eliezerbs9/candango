import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationDto } from './dto/organization.dto';

@UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly svc: OrganizationService) {}

  @Get()
  get(@CurrentUser() u: AuthContext) {
    return this.svc.get(u.orgId);
  }

  @Patch()
  @UseGuards(AdminGuard)
  update(@CurrentUser() u: AuthContext, @Body() dto: UpdateOrganizationDto) {
    return this.svc.update(u.orgId, dto);
  }
}
