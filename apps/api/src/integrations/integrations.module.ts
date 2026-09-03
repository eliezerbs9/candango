import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { QuickbooksController } from './quickbooks.controller';
import { QuickbooksOAuthService } from './quickbooks-oauth.service';
import { QuickbooksApiService } from './quickbooks-api.service';
import { CompanyCamController } from './companycam.controller';
import { CompanyCamOAuthService } from './companycam-oauth.service';
import { CompanyCamApiService } from './companycam-api.service';

// AuthModule provides JwtModule (used to sign/verify the OAuth `state`) and the
// JWT strategy behind JwtAuthGuard. PrismaService + ConfigService are global.
@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: 'gmail-sync' }, { name: 'calendar-sync' })],
  controllers: [IntegrationsController, QuickbooksController, CompanyCamController],
  providers: [GoogleOAuthService, QuickbooksOAuthService, QuickbooksApiService, CompanyCamOAuthService, CompanyCamApiService],
  exports: [GoogleOAuthService, QuickbooksOAuthService, QuickbooksApiService, CompanyCamOAuthService, CompanyCamApiService],
})
export class IntegrationsModule {}
