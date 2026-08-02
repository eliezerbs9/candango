import { Module } from '@nestjs/common';
import { EmailAutomationsController } from './email-automations.controller';
import { EmailAutomationsService } from './email-automations.service';

@Module({
  controllers: [EmailAutomationsController],
  providers: [EmailAutomationsService],
  exports: [EmailAutomationsService],
})
export class EmailAutomationsModule {}
