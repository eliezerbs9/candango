import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenant context (multi-tenancy hardening — see [[Multi-Tenancy & Security]]).
 *
 * A middleware opens an empty store for every HTTP request; the auth guards fill in
 * the `orgId` once the principal is known. The Prisma tenant extension reads it to
 * (1) auto-scope queries by `orgId` (app-level RLS) and (2) set the Postgres
 * `app.current_org_id` GUC that drives the database row-level-security policies.
 *
 * When there is no `orgId` in context (unauthenticated routes, the Stripe webhook,
 * startup code) the extension sets `app.bypass_rls` instead — these paths are trusted
 * and run unscoped, exactly as before.
 */
interface TenantStore {
  orgId: string | null;
  /** True while inside a managed transaction whose connection already has the RLS GUC set. */
  inTx?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Open a fresh tenant scope for the duration of `fn` (used by the request middleware). */
export function runInTenantScope<T>(fn: () => T): T {
  return storage.run({ orgId: null }, fn);
}

/** Run `fn` with an explicit orgId already set (handy for tests / scripts). */
export function runWithOrg<T>(orgId: string | null, fn: () => T): T {
  return storage.run({ orgId }, fn);
}

/** The raw store for the current scope (used by the Prisma extension). */
export function getTenantStore(): TenantStore | undefined {
  return storage.getStore();
}

/** Set the tenant for the current request scope (called by the auth guards). */
export function setTenantOrgId(orgId: string | null): void {
  const store = storage.getStore();
  if (store) store.orgId = orgId;
}

/** The orgId for the current async scope, or null when unscoped. */
export function getTenantOrgId(): string | null {
  return storage.getStore()?.orgId ?? null;
}
