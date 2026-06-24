import type { NextFunction, Request, Response } from 'express';
import { runInTenantScope } from './tenant-context';

/**
 * Opens a per-request tenant scope (AsyncLocalStorage) so the auth guards can record
 * the orgId and the Prisma tenant extension can enforce isolation downstream.
 * Registered globally in main.ts before the Nest router.
 */
export function tenantContextMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  runInTenantScope(() => next());
}
