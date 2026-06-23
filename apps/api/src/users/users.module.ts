import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [MailModule, TokensModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
