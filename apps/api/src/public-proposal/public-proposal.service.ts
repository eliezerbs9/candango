import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService, collectPricingDocs, shapeProposal } from '../proposals/proposals.service';
import { collectProposalPricingIds, normalizeProposalFields } from '../proposals/proposal-fields';
import { DealValueService } from '../deals/deal-value.service';
import { DealEventsService } from '../deal-events/deal-events.service';
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
    private readonly dealValue: DealValueService,
    private readonly dealEvents: DealEventsService,
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
    // Internal (client-hidden) fields must NEVER reach the public page — strip them.
    const { fields: _f, fieldValues: _fv, ...pub } = shapeProposal(p);
    return { ...pub, ...render };
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

    // Roll the decision onto every linked estimate's INTERNAL status in our DB (accepted → accepted,
    // declined → rejected) — including the local mirror of QuickBooks-sourced estimates. This is a
    // plain DB update; nothing is pushed to QuickBooks.
    const estStatus = dto.decision === 'accepted' ? 'accepted' : dto.decision === 'denied' ? 'rejected' : null;
    if (estStatus) {
      // Every estimate the proposal references: pricing elements ∪ estimate fields ∪ legacy.
      const linked = collectProposalPricingIds(
        normalizeProposalFields(p.fields),
        (p.fieldValues ?? {}) as Record<string, unknown>,
        collectPricingDocs(p.content),
        p.estimateIds,
      );
      if (linked.estimateIds.length) {
        await this.prisma.dealEstimate.updateMany({
          where: { id: { in: linked.estimateIds }, orgId: p.orgId, deletedAt: null, status: { notIn: ['closed'] } },
          data: { status: estStatus },
        });
      }
      await this.dealValue.recompute(p.orgId, p.dealId); // estimate status changed → deal value
    }

    // Log the outcome on the deal timeline, attributed to the client (it came through the public link).
    const verb = dto.decision === 'accepted' ? 'accepted' : dto.decision === 'denied' ? 'declined' : 'deferred';
    await this.dealEvents.log(p.orgId, p.dealId, {
      kind: 'proposal',
      title: `Proposal “${p.title}” ${verb}`,
      body: feedback ? `Note: ${feedback}` : null,
      actor: 'Client via proposal link',
    });

    if (dto.decision === 'accepted') {
      this.events.emit('webhook.event', { orgId: p.orgId, type: 'proposal.accepted', data: { deal: { id: p.dealId }, proposal: { id: p.id } } });
    }
    const { fields: _f, fieldValues: _fv, ...pub } = shapeProposal(row);
    return pub;
  }
}
