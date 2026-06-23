import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type TokenType = 'invite' | 'password_reset' | 'email_verify';

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * Issues and consumes single-use, hashed tokens (invites, password resets,
 * email verification). The raw token is returned once for emailing; only its
 * SHA-256 hash is persisted. See [[Transactional Email]].
 */
@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token, stores only its hash, and returns the raw value (to email). */
  async issue(orgId: string, userId: string, type: TokenType, ttlMs: number): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.authToken.create({
      data: {
        orgId,
        userId,
        type,
        tokenHash: hash(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  /**
   * Validates a raw token of the given type and marks it used (single-use).
   * Throws BadRequest if the token is unknown, wrong type, expired, or already used.
   */
  async consume(type: TokenType, raw: string): Promise<{ userId: string; orgId: string }> {
    const token = await this.prisma.authToken.findUnique({ where: { tokenHash: hash(raw) } });
    if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    return { userId: token.userId, orgId: token.orgId };
  }
}
