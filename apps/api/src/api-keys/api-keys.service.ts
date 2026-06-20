import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/api-key.dto';

const SELECT = {
  id: true,
  name: true,
  prefix: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  }

  /** Generates the secret, stores only its hash + prefix, and returns the secret ONCE. */
  async create(orgId: string, createdBy: string, dto: CreateApiKeyDto) {
    const raw = randomBytes(24).toString('hex');
    const secret = `sk_live_${raw}`;
    const prefix = secret.slice(0, 12);
    const keyHash = createHash('sha256').update(secret).digest('hex');

    const row = await this.prisma.apiKey.create({
      data: { orgId, name: dto.name, keyHash, prefix, scopes: dto.scopes, createdBy },
      select: SELECT,
    });
    return { ...row, secret };
  }

  async revoke(orgId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, orgId, revokedAt: null } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
