import { apiFetch } from './client';

export type SignatureStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';

export interface SignatureRequest {
  id: string;
  dealId: string;
  title: string;
  status: SignatureStatus;
  signerName: string | null;
  signerEmail: string | null;
  hasSigned: boolean;
  auditUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** create() also returns the signer's link (email may or may not be sent). */
export interface CreatedSignature extends SignatureRequest {
  signingUrl?: string;
}

export interface SignatureBody {
  dealId: string;
  title: string;
  fileKey: string;
  signerName?: string;
  signerEmail: string;
  sendEmail?: boolean;
  acceptance?: boolean;
  initialsEveryPage?: boolean;
}

export function getDealSignatures(token: string, dealId: string) {
  return apiFetch<SignatureRequest[]>(`/signatures?dealId=${encodeURIComponent(dealId)}`, { token });
}

export function createSignature(token: string, body: SignatureBody) {
  return apiFetch<CreatedSignature>('/signatures', { method: 'POST', token, body: JSON.stringify(body) });
}

export function deleteSignature(token: string, id: string) {
  return apiFetch<void>(`/signatures/${id}`, { method: 'DELETE', token });
}

export function getSignatureSignedUrl(token: string, id: string) {
  return apiFetch<{ url: string }>(`/signatures/${id}/signed-url`, { token });
}
