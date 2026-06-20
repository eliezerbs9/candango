import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  @Get()
  me(@CurrentUser() u: AuthContext) {
    return this.svc.getMe(u.userId, u.orgId);
  }

  @Patch()
  update(@CurrentUser() u: AuthContext, @Body() dto: UpdateProfileDto) {
    return this.svc.update(u.userId, u.orgId, dto);
  }

  @Post('password')
  changePassword(@CurrentUser() u: AuthContext, @Body() dto: ChangePasswordDto) {
    return this.svc.changePassword(u.userId, u.orgId, dto);
  }
}
