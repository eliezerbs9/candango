import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { MessagesModule } from '../messages/messages.module';
import { ProposalTemplatesController } from './proposal-templates.controller';
import { ProposalTemplatesService } from './proposal-templates.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [UploadsModule, MessagesModule],
  controllers: [ProposalTemplatesController, ProposalsController],
  providers: [ProposalTemplatesService, ProposalsService],
  exports: [ProposalTemplatesService, ProposalsService],
})
export class ProposalsModule {}
