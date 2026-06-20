import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid JWT; populates req.user with the tenant context. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
