import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingDto } from './dto/onboarding.dto';

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get()
  get(@CurrentUser() u: AuthContext) {
    return this.svc.get(u.orgId);
  }

  @Patch()
  update(@CurrentUser() u: AuthContext, @Body() dto: UpdateOnboardingDto) {
    return this.svc.update(u.orgId, dto.completed);
  }
}
