import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MessagesModule } from '../messages/messages.module';
import { SignaturesController } from './signatures.controller';
import { SignatureTemplatesController } from './signature-templates.controller';
import { SignableDocumentsController } from './signable-documents.controller';
import { SignatureWebhookController } from './signature-webhook.controller';
import { SignaturesService } from './signatures.service';
import { SignatureTemplatesService } from './signature-templates.service';
import { SignableDocumentsService } from './signable-documents.service';
import { DocumensoService } from './documenso.service';

@Module({
  imports: [PrismaModule, UploadsModule, MessagesModule],
  controllers: [SignaturesController, SignatureTemplatesController, SignableDocumentsController, SignatureWebhookController],
  providers: [SignaturesService, SignatureTemplatesService, SignableDocumentsService, DocumensoService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
