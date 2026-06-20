import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated principal, from a user JWT or an API key. Carries the tenant (orgId). */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
  authType?: 'user' | 'api_key';
  scopes?: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().user as AuthContext;
  },
);
