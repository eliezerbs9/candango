'use client';

import { useParams } from 'next/navigation';
import { ProposalBuilder } from '@/components/proposals/DealProposals';

// The proposal builder rendered INSIDE the deal (keeps the deal header + tabs from the deal layout),
// at /deals/<dealId>/proposals/<proposalId>. Mirrors the signable-document builder route.
export default function DealProposalBuilderPage() {
  const { proposalId } = useParams<{ id: string; proposalId: string }>();
  return <ProposalBuilder id={proposalId} />;
}
