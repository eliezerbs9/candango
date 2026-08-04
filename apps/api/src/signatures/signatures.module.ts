import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SignaturesController } from './signatures.controller';
import { SignatureTemplatesController } from './signature-templates.controller';
import { SignatureWebhookController } from './signature-webhook.controller';
import { SignaturesService } from './signatures.service';
import { SignatureTemplatesService } from './signature-templates.service';
import { DocusealService } from './docuseal.service';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [SignaturesController, SignatureTemplatesController, SignatureWebhookController],
  providers: [SignaturesService, SignatureTemplatesService, DocusealService],
})
export class SignaturesModule {}
