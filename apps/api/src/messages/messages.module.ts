import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { InboundEmailController } from './inbound-email.controller';
import { InboundEmailService } from './inbound-email.service';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController, InboundEmailController],
  providers: [MessagesService, InboundEmailService],
})
export class MessagesModule {}
