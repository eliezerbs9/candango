import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealQuickbooksController } from './quickbooks/deal-quickbooks.controller';
import { DealQuickbooksService } from './quickbooks/deal-quickbooks.service';

@Module({
  imports: [AuthModule, IntegrationsModule],
  controllers: [DealsController, DealQuickbooksController],
  providers: [DealsService, DealQuickbooksService],
})
export class DealsModule {}
