import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealQuickbooksController } from './quickbooks/deal-quickbooks.controller';
import { DealQuickbooksService } from './quickbooks/deal-quickbooks.service';
import { QuickbooksWebhookController } from './quickbooks/quickbooks-webhook.controller';

@Module({
  imports: [AuthModule, IntegrationsModule],
  controllers: [DealsController, DealQuickbooksController, QuickbooksWebhookController],
  providers: [DealsService, DealQuickbooksService],
})
export class DealsModule {}
