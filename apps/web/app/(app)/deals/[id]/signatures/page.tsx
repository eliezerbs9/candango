'use client';

import { DealSignatures } from '@/components/deals/DealSignatures';
import { useDealCtx } from '@/components/deals/DealContext';

export default function DealSignaturesPage() {
  const { deal } = useDealCtx();
  return <DealSignatures dealId={deal.id} />;
}
