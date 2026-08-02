import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { EmailAutomationsController } from './email-automations.controller';
import { EmailAutomationsService } from './email-automations.service';
import { EmailAutomationsRunner } from './email-automations.runner';

@Module({
  imports: [MessagesModule],
  controllers: [EmailAutomationsController],
  providers: [EmailAutomationsService, EmailAutomationsRunner],
  exports: [EmailAutomationsService],
})
export class EmailAutomationsModule {}
