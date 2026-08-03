import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RespondProposalDto } from '../proposals/dto/proposal.dto';
import { PublicProposalService } from './public-proposal.service';

/** Unauthenticated proposal presentation (no JwtAuthGuard) — accessed by the recipient via shareToken. */
@Controller('public/proposals')
export class PublicProposalController {
  constructor(private readonly svc: PublicProposalService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.svc.get(token);
  }

  @Post(':token/respond')
  respond(@Param('token') token: string, @Body() dto: RespondProposalDto) {
    return this.svc.respond(token, dto);
  }
}
