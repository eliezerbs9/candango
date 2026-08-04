'use client';

import { DealProposals } from '@/components/proposals/DealProposals';
import { useDealCtx } from '@/components/deals/DealContext';

export default function DealProposalsPage() {
  const { deal } = useDealCtx();
  return <DealProposals dealId={deal.id} />;
}
