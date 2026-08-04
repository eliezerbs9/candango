import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService, shapeProposal } from '../proposals/proposals.service';
import { RespondProposalDto } from '../proposals/dto/proposal.dto';

/**
 * Public (unauthenticated) presentation of a proposal, looked up by its opaque `shareToken`. Runs
 * with RLS bypassed (no tenant context) exactly like the email-preferences page — every query is
 * scoped by the token / the proposal's own orgId, never by a request org. Never exposes org internals.
 */
@Injectable()
export class PublicProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
    private readonly events: EventEmitter2,
  ) {}

  private async byToken(token: string) {
    const p = await this.prisma.proposal.findFirst({ where: { shareToken: token } });
    if (!p) throw new NotFoundException('This proposal link is no longer valid.');
    return p;
  }

  /** The full render payload for the public page; marks a sent proposal as viewed on first open. */
  async get(token: string) {
    const p = await this.byToken(token);
    if (p.status === 'sent') {
      await this.prisma.proposal.update({ where: { id: p.id }, data: { status: 'viewed', viewedAt: p.viewedAt ?? new Date() } });
      p.status = 'viewed';
    }
    const render = await this.proposals.renderData(p.orgId, p.dealId, p.estimateIds, p.content);
    return { ...shapeProposal(p), ...render };
  }

  /**
   * Record the recipient's decision. Feedback is required to deny/defer. Accepting/declining also
   * updates the linked estimates' status and logs the outcome on the deal timeline; accepting fires
   * an automation event.
   */
  async respond(token: string, dto: RespondProposalDto) {
    const p = await this.byToken(token);
    if ((dto.decision === 'denied' || dto.decision === 'deferred') && !dto.feedback?.trim()) {
      throw new BadRequestException('Please add a short note so we know how to help.');
    }
    const feedback = dto.feedback?.trim() || null;
    const row = await this.prisma.proposal.update({
      where: { id: p.id },
      data: { status: dto.decision, feedback, respondedAt: new Date() },
    });

    // Roll the decision onto the linked estimates (accepted → accepted, declined → rejected).
    const estStatus = dto.decision === 'accepted' ? 'accepted' : dto.decision === 'denied' ? 'rejected' : null;
    if (estStatus && p.estimateIds.length) {
      await this.prisma.dealEstimate.updateMany({
        where: { id: { in: p.estimateIds }, orgId: p.orgId, deletedAt: null, status: { notIn: ['closed'] } },
        data: { status: estStatus },
      });
    }

    // Log the outcome on the deal timeline (as a note authored by the proposal's creator / deal owner).
    const author = p.createdByUserId ?? (await this.prisma.deal.findFirst({ where: { id: p.dealId }, select: { ownerUserId: true } }))?.ownerUserId;
    if (author) {
      const verb = dto.decision === 'accepted' ? 'accepted' : dto.decision === 'denied' ? 'declined' : 'chose to decide later on';
      await this.prisma.note.create({
        data: {
          orgId: p.orgId,
          dealId: p.dealId,
          authorUserId: author,
          body: `Proposal “${p.title}” was ${verb} by the customer.${feedback ? ` Note: ${feedback}` : ''}`,
        },
      });
    }

    if (dto.decision === 'accepted') {
      this.events.emit('webhook.event', { orgId: p.orgId, type: 'proposal.accepted', data: { deal: { id: p.dealId }, proposal: { id: p.id } } });
    }
    return shapeProposal(row);
  }
}
