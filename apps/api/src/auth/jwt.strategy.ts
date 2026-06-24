import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthContext } from './current-user.decorator';
import { setTenantOrgId } from '../prisma/tenant-context';

interface JwtPayload {
  sub: string;
  orgId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
    });
  }

  validate(payload: JwtPayload): AuthContext {
    // Returned object is attached to req.user (the tenant context).
    setTenantOrgId(payload.orgId); // scope all downstream Prisma queries to this tenant
    return { userId: payload.sub, orgId: payload.orgId, role: payload.role };
  }
}
