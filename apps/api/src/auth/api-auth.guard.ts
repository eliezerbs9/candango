import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SCOPES_KEY } from './scopes.decorator';
import type { AuthContext } from './current-user.decorator';
import { setTenantOrgId } from '../prisma/tenant-context';

/**
 * Accepts a user session JWT OR an API key (`sk_live_…`) as a Bearer token.
 * For API-key callers, enforces the route's @Scopes(...) (JWT users are
 * session-authorized and skip scope checks for now).
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = header.slice(7).trim();

    const user = token.startsWith('sk_live_')
      ? await this.fromApiKey(token)
      : await this.fromJwt(token);
    req.user = user;
    setTenantOrgId(user.orgId); // scope all downstream Prisma queries to this tenant

    const required =
      this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (user.authType === 'api_key' && required.length > 0) {
      const scopes = user.scopes ?? [];
      const ok = scopes.includes('*') || required.every((s) => scopes.includes(s));
      if (!ok) throw new ForbiddenException(`API key missing scope: ${required.join(', ')}`);
    }
    return true;
  }

  private async fromApiKey(token: string): Promise<AuthContext> {
    const keyHash = createHash('sha256').update(token).digest('hex');
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt.getTime() < Date.now())) {
      throw new UnauthorizedException('Invalid API key');
    }
    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return { authType: 'api_key', orgId: key.orgId, userId: key.createdBy, role: 'ApiKey', scopes: key.scopes };
  }

  private async fromJwt(token: string): Promise<AuthContext> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; orgId: string; role: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      });
      return { authType: 'user', userId: payload.sub, orgId: payload.orgId, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
