import { createDecipheriv, createHash } from 'node:crypto';

/**
 * Decrypts OAuth tokens encrypted by the API (AES-256-GCM). The key derivation
 * MUST match apps/api/src/integrations/crypto.util.ts — set the same
 * `GOOGLE_TOKEN_ENC_KEY` in both apps/api/.env and apps/workers/.env.
 */
function key(): Buffer {
  const secret =
    process.env.GOOGLE_TOKEN_ENC_KEY || process.env.JWT_SECRET || 'dev-secret-change-me';
  return createHash('sha256').update(secret).digest();
}

export function decryptToken(blob: string): string {
  const [ivHex, tagHex, dataHex] = blob.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
