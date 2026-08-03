import { apiFetch } from './client';
import type { Proposal, ProposalRenderData } from './proposals';

export type ProposalDecision = 'accepted' | 'denied' | 'deferred';

/** Public (unauthenticated) proposal presentation, by shareToken. */
export function getPublicProposal(token: string) {
  return apiFetch<ProposalRenderData>(`/public/proposals/${encodeURIComponent(token)}`);
}

export function respondPublicProposal(token: string, decision: ProposalDecision, feedback?: string) {
  return apiFetch<Proposal>(`/public/proposals/${encodeURIComponent(token)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision, feedback }),
  });
}
