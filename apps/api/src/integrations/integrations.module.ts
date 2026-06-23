import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { GoogleOAuthService } from './google-oauth.service';

// AuthModule provides JwtModule (used to sign/verify the OAuth `state`) and the
// JWT strategy behind JwtAuthGuard. PrismaService + ConfigService are global.
@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: 'gmail-sync' })],
  controllers: [IntegrationsController],
  providers: [GoogleOAuthService],
  exports: [GoogleOAuthService],
})
export class IntegrationsModule {}
