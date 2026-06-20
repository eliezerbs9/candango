import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated principal, derived from the JWT. Carries the tenant (orgId). */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().user as AuthContext;
  },
);
