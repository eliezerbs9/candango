import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantOrgId, getTenantStore } from './tenant-context';

/** Models carrying an `orgId` column — auto-scoped at the app layer (Layer 1). */
const TENANT_MODELS = new Set<string>([
  'User', 'AuthToken', 'Team', 'Role', 'Pipeline', 'Stage', 'Deal', 'Person',
  'Company', 'Activity', 'DealStageEvent', 'Note', 'CalendarConnection',
  'CalendarEvent', 'MailboxConnection', 'Message', 'Webhook', 'WebhookDelivery',
  'EventOutbox', 'ApiKey', 'AuditLog', 'Subscription', 'Invoice',
  'CustomFieldDefinition', 'QuickBooksConnection', 'QuickBooksCustomerLink',
  'DealEstimate', 'DealInvoice',
]);

/**
 * Filter-based operations where we can safely AND an `orgId` into the where clause.
 * (Creates already require a non-null orgId from the caller; by-id ops use a unique
 * where that can't take extra fields — both are covered by the database RLS policies.)
 */
const WHERE_OPS = new Set<string>([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'updateMany', 'deleteMany',
]);

/**
 * Tenant-aware Prisma client. Two layers of isolation (see [[Multi-Tenancy & Security]]):
 *  - **Layer 1 (app):** auto-injects `orgId` into tenant-model queries so a forgotten
 *    `where` clause can't leak across tenants.
 *  - **Layer 2 (db):** wraps every operation in a transaction that sets the Postgres
 *    `app.current_org_id` (or `app.bypass_rls`) GUC, which the RLS policies enforce.
 */
/** SQL that pins the per-connection RLS context for the current tenant scope. */
function gucSetting(orgId: string | null) {
  return orgId
    ? Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`
    : Prisma.sql`SELECT set_config('app.bypass_rls', 'on', true)`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Interactive transaction with the RLS context set on its connection.
   * Use this instead of `$transaction(fn)` so multi-statement writes stay tenant-scoped.
   * (Declared here for typing; the real implementation is installed via `$extends`.)
   */
  $tx!: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

  constructor() {
    super();
    // `base` is the un-extended client; the extension uses it to run the
    // GUC-setting transaction without re-entering the query hook.
    const base = this;
    const extended = this.$extends({
      client: {
        async $tx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
          const orgId = getTenantOrgId();
          const store = getTenantStore();
          return base.$transaction(async (tx) => {
            // Pin the RLS context once; it applies to every statement in this tx.
            await tx.$executeRaw(gucSetting(orgId));
            const prev = store?.inTx ?? false;
            if (store) store.inTx = true;
            try {
              return await fn(tx);
            } finally {
              if (store) store.inTx = prev;
            }
          });
        },
      },
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const store = getTenantStore();
            const orgId = store?.orgId ?? null;

            // Layer 1 — app-level scoping.
            let nextArgs = args;
            if (orgId && model && TENANT_MODELS.has(model) && WHERE_OPS.has(operation)) {
              const a = (args ?? {}) as { where?: unknown };
              nextArgs = { ...a, where: a.where ? { AND: [a.where, { orgId }] } : { orgId } } as typeof args;
            }

            // Inside a managed $tx the connection's RLS context is already set.
            if (store?.inTx) return query(nextArgs);

            // Layer 2 — set the RLS GUC for this single op's implicit transaction.
            const [, result] = await base.$transaction([base.$executeRaw(gucSetting(orgId)), query(nextArgs)]);
            return result;
          },
        },
      },
    });
    return extended as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
