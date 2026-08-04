import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SignaturesController } from './signatures.controller';
import { SignatureTemplatesController } from './signature-templates.controller';
import { SignableDocumentsController } from './signable-documents.controller';
import { SignatureWebhookController } from './signature-webhook.controller';
import { SignaturesService } from './signatures.service';
import { SignatureTemplatesService } from './signature-templates.service';
import { SignableDocumentsService } from './signable-documents.service';
import { DocusealService } from './docuseal.service';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [SignaturesController, SignatureTemplatesController, SignableDocumentsController, SignatureWebhookController],
  providers: [SignaturesService, SignatureTemplatesService, SignableDocumentsService, DocusealService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
