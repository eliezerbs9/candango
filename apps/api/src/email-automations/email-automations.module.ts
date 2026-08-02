import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagesModule } from '../messages/messages.module';
import { EmailAutomationsController } from './email-automations.controller';
import { EmailAutomationsService } from './email-automations.service';
import { EmailAutomationsExecutor } from './email-automations.executor';
import { EmailAutomationsRunner } from './email-automations.runner';
import { AutomationScanProcessor } from './automation-scan.processor';

@Module({
  imports: [MessagesModule, BullModule.registerQueue({ name: 'automation-scan' })],
  controllers: [EmailAutomationsController],
  providers: [EmailAutomationsService, EmailAutomationsExecutor, EmailAutomationsRunner, AutomationScanProcessor],
  exports: [EmailAutomationsService],
})
export class EmailAutomationsModule {}
