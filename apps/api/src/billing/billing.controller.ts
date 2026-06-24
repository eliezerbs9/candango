import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';

@UseGuards(ApiAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  status(@CurrentUser() u: AuthContext) {
    return this.svc.status(u.orgId);
  }

  @Post('checkout')
  checkout(@CurrentUser() u: AuthContext) {
    return this.svc.checkout(u.orgId);
  }

  @Post('portal')
  portal(@CurrentUser() u: AuthContext) {
    return this.svc.portal(u.orgId);
  }
}
