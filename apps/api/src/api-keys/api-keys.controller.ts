import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/api-key.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateApiKeyDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.revoke(u.orgId, id);
  }
}
