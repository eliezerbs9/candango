import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { PublicProposalController } from './public-proposal.controller';
import { PublicProposalService } from './public-proposal.service';

@Module({
  imports: [PrismaModule, ProposalsModule],
  controllers: [PublicProposalController],
  providers: [PublicProposalService],
})
export class PublicProposalModule {}
