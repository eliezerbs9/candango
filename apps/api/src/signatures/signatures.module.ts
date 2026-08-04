import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SignaturesController } from './signatures.controller';
import { SignatureWebhookController } from './signature-webhook.controller';
import { SignaturesService } from './signatures.service';
import { DocusealService } from './docuseal.service';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [SignaturesController, SignatureWebhookController],
  providers: [SignaturesService, DocusealService],
})
export class SignaturesModule {}
