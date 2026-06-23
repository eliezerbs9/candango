import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';

// The send worker (EmailProcessor) lives in apps/workers and consumes this
// same `email` queue. The API only renders + enqueues.
@Module({
  imports: [BullModule.registerQueue({ name: 'email' })],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
