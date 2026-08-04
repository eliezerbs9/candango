import { apiFetch } from './client';
import type { DrawnField } from './signature-templates';

export type SignatureStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';

export interface SignatureRequest {
  id: string;
  dealId: string;
  title: string;
  status: SignatureStatus;
  signerName: string | null;
  signerEmail: string | null;
  sourceFileKey: string | null;
  signedFileKey: string | null;
  hasSigned: boolean;
  hasInitials: boolean;
  /** The signing parties + their status, for the card. */
  signers: { name: string; owner: boolean; signed: boolean }[];
  /** The workspace's own signing link (both-parties), so the owner can sign their part. */
  ownerSignUrl: string | null;
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
  bothParties?: boolean;
  signatureTemplateId?: string;
  acceptance?: boolean;
  initialsEveryPage?: boolean;
  drawnFields?: DrawnField[];
}

export function getDealSignatures(token: string, dealId: string) {
  return apiFetch<SignatureRequest[]>(`/signatures?dealId=${encodeURIComponent(dealId)}`, { token });
}

export function createSignature(token: string, body: SignatureBody) {
  return apiFetch<CreatedSignature>('/signatures', { method: 'POST', token, body: JSON.stringify(body) });
}

export interface GenerateSignatureBody {
  dealId: string;
  signableDocumentTemplateId: string;
  signerName?: string;
  signerEmail?: string;
  sendEmail?: boolean;
  bothParties?: boolean;
}

export function generateSignature(token: string, body: GenerateSignatureBody) {
  return apiFetch<CreatedSignature>('/signatures/generate', { method: 'POST', token, body: JSON.stringify(body) });
}

export function deleteSignature(token: string, id: string) {
  return apiFetch<void>(`/signatures/${id}`, { method: 'DELETE', token });
}

export function resendSignature(token: string, id: string) {
  return apiFetch<{ ok: boolean }>(`/signatures/${id}/resend`, { method: 'POST', token });
}

export function getSignatureSignedUrl(token: string, id: string) {
  return apiFetch<{ url: string }>(`/signatures/${id}/signed-url`, { token });
}
