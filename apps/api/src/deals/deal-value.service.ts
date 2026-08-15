import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Computes a deal's value from its documents — deterministic, no double-counting.
 *
 *   value = REALIZED + OPEN
 *   REALIZED = Σ(non-void invoices)                       // billed money; multiple invoices sum
 *   OPEN     = Σ(estimates in the single highest status   // accepted > sent > draft
 *               tier present, excluding closed/rejected)  // a lower tier is ignored while a higher exists
 *
 * A converted estimate is `closed` (excluded) so an invoice never double-counts its source. When the deal
 * has no documents at all the value is left manual/editable (not overwritten).
 */
@Injectable()
export class DealValueService {
  constructor(private readonly prisma: PrismaService) {}

  async recompute(orgId: string, dealId: string): Promise<number> {
    const [invoices, estimates] = await Promise.all([
      this.prisma.dealInvoice.findMany({
        where: { orgId, dealId, deletedAt: null, status: { not: 'void' } },
        select: { totalAmount: true },
      }),
      this.prisma.dealEstimate.findMany({
        where: { orgId, dealId, deletedAt: null, status: { notIn: ['closed', 'rejected'] } },
        select: { totalAmount: true, status: true },
      }),
    ]);

    const realized = invoices.reduce((s, i) => s + i.totalAmount, 0);
    // Highest status tier present among the deal's live estimates.
    const tier = estimates.some((e) => e.status === 'accepted')
      ? 'accepted'
      : estimates.some((e) => e.status === 'sent')
        ? 'sent'
        : estimates.some((e) => e.status === 'draft')
          ? 'draft'
          : null;
    const open = tier ? estimates.filter((e) => e.status === tier).reduce((s, e) => s + e.totalAmount, 0) : 0;
    const value = realized + open;

    // Only take over the value once the deal is document-backed; otherwise leave the manual value alone.
    if (invoices.length || estimates.length) {
      await this.prisma.deal.update({ where: { id: dealId }, data: { value, valueOverridden: true } });
    }
    return value;
  }
}
