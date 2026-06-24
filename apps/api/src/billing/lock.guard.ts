import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Paths that must stay reachable while locked so the user can still pay / authenticate.
const EXEMPT_PREFIXES = ['/v1/billing', '/v1/auth'];

/**
 * Read-only lock enforcement (FR-10.5). Runs globally: when a workspace is locked
 * (trial elapsed or dunning exhausted without an active subscription), every write
 * request is rejected with 402 — except billing/auth routes, so the user can pay.
 * Reads (GET/HEAD/OPTIONS) are always allowed. Resolves the tenant from the bearer
 * token itself (JWT or API key) so it doesn't depend on the per-route auth guard.
 */
@Injectable()
export class LockGuard implements CanActivate {
  constructor(
    private readonly billing: BillingService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    if (!WRITE_METHODS.has(req.method)) return true;
    const path: string = req.path ?? req.url ?? '';
    if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return true;

    const orgId = await this.orgIdFromRequest(req);
    if (!orgId) return true; // unauthenticated → let the auth guard reject it

    if (await this.billing.isOrgLocked(orgId)) {
      throw new HttpException(
        'Your workspace is in read-only mode — add a payment method to continue (Settings → Billing).',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }

  private async orgIdFromRequest(req: { headers: Record<string, unknown> }): Promise<string | null> {
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    if (token.startsWith('sk_live_')) {
      const keyHash = createHash('sha256').update(token).digest('hex');
      const key = await this.prisma.apiKey.findUnique({ where: { keyHash }, select: { orgId: true, revokedAt: true } });
      return key && !key.revokedAt ? key.orgId : null;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ orgId?: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      });
      return payload.orgId ?? null;
    } catch {
      return null;
    }
  }
}
