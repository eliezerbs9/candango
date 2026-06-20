import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthContext } from './current-user.decorator';

/** Allows only users whose role is "Admin". Use after JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as AuthContext | undefined;
    if (user?.role !== 'Admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
