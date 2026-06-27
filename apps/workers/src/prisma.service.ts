import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Workers are trusted background processors that operate across ALL tenants (no per-request
 * org). The DB enforces FORCE row-level security, so every query runs with `app.bypass_rls=on`
 * set on its implicit transaction — otherwise the app role sees zero rows. (The API instead
 * sets `app.current_org_id` per request; see its PrismaService.)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const base = this;
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await base.$transaction([
              base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`,
              query(args),
            ]);
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
