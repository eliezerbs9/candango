import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { QuickbooksController } from './quickbooks.controller';
import { QuickbooksOAuthService } from './quickbooks-oauth.service';

// AuthModule provides JwtModule (used to sign/verify the OAuth `state`) and the
// JWT strategy behind JwtAuthGuard. PrismaService + ConfigService are global.
@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: 'gmail-sync' })],
  controllers: [IntegrationsController, QuickbooksController],
  providers: [GoogleOAuthService, QuickbooksOAuthService],
  exports: [GoogleOAuthService, QuickbooksOAuthService],
})
export class IntegrationsModule {}
