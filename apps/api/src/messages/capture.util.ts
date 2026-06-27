import { randomBytes } from 'node:crypto';

/**
 * Email-capture address helpers for the BCC / inbound-parse model (FR-5.8).
 * Each user has a unique token; their capture address is `<token>@<EMAIL_INBOUND_DOMAIN>`.
 */

/** Generate a new email-safe capture token (16 hex chars). */
export function newCaptureToken(): string {
  return randomBytes(8).toString('hex');
}

/** Build a user's capture address from their token + the inbound domain. */
export function buildCaptureAddress(token: string, domain: string): string {
  return `${token}@${domain}`;
}

/** Strip a display name → bare lowercased email (`"Jo <a@b>"` → `a@b`). */
export function emailOf(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

/**
 * Pull the capture token out of an address `<token>@<domain>` (case-insensitive).
 * Returns null when the address doesn't belong to the capture domain.
 */
export function parseCaptureToken(address: string, domain: string): string | null {
  const at = emailOf(address);
  const suffix = `@${domain.toLowerCase()}`;
  if (!domain || !at.endsWith(suffix)) return null;
  const local = at.slice(0, -suffix.length);
  return local || null;
}
