import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for OAuth tokens at rest (AES-256-GCM). The key is
 * derived from `GOOGLE_TOKEN_ENC_KEY` (set a dedicated 32+ char secret in prod);
 * falls back to `JWT_SECRET` so dev works out of the box. Format: `iv:tag:cipher` (hex).
 */
function key(): Buffer {
  const secret =
    process.env.GOOGLE_TOKEN_ENC_KEY || process.env.JWT_SECRET || 'dev-secret-change-me';
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decryptToken(blob: string): string {
  const [ivHex, tagHex, dataHex] = blob.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
