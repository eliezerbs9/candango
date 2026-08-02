import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicEmailController } from './public-email.controller';
import { PublicEmailService } from './public-email.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicEmailController],
  providers: [PublicEmailService],
})
export class PublicEmailModule {}
