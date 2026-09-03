#!/usr/bin/env node
/**
 * Pre-flight cleanup for the dev/sandbox → production key flip.
 *
 * WHAT IT CLEANS, AND WHY ONLY THIS
 * Flipping the app to live provider keys strands three kinds of row, because each one holds a
 * handle issued by the *sandbox/test* side of a provider that simply does not exist in live:
 *   - QuickBooksConnection  — sandbox OAuth tokens. After QBO_ENVIRONMENT=production the refresh
 *                             worker calls the live API with them and the workspace breaks.
 *   - CompanyCamConnection  — same shape (and its refresh token rotates on every use).
 *   - Subscription          — test-mode stripeCustomerId / stripeSubscriptionId. Against live keys
 *                             Stripe answers 404 and billing state can't be read.
 * All three are leaf tables (referenced only as an optional child of Organization), so deleting
 * their rows needs no ordering and touches nothing else.
 *
 * It deliberately does NOT hard-delete organizations. None of Organization's 18 relations declare
 * onDelete: Cascade — they're all Restrict — so a row-by-row cascade would mean ~30 tables in
 * dependency order, which is not something to run blind against production. Test-tenant deals and
 * contacts are tenant-scoped and invisible to other workspaces; use --soft-delete to hide a whole
 * test workspace instead (sets Organization.deletedAt, which the app already honours).
 *
 * RLS: every statement runs inside one transaction that first sets app.bypass_rls, matching
 * PrismaService's Layer-2 contract. Without it the policies would scope us to no tenant and every
 * count would come back zero — silently.
 *
 * The target is read from CANDANGO_TARGET_DATABASE_URL, *not* DATABASE_URL. That is deliberate:
 * importing @prisma/client auto-loads any .env in scope, so a plain DATABASE_URL script silently
 * points at whatever happens to be lying around — it targeted localhost when first tested. A name
 * no dotenv file defines means the database you delete from is always the one you typed.
 *
 * USAGE (from the repo root)
 *   Inventory only, changes nothing:
 *     CANDANGO_TARGET_DATABASE_URL=… node scripts/prod-flip-cleanup.mjs
 *   Delete the stranded integration/billing rows:
 *     CANDANGO_TARGET_DATABASE_URL=… node scripts/prod-flip-cleanup.mjs --apply --yes
 *   Also hide specific test workspaces:
 *     … node scripts/prod-flip-cleanup.mjs --apply --yes --soft-delete=<orgId>,<orgId>
 *   Limit the deletes to specific workspaces (default: all — correct pre-launch, when no
 *   workspace is a real paying customer yet):
 *     … node scripts/prod-flip-cleanup.mjs --apply --yes --only=<orgId>,<orgId>
 */
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const listArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).split(',').map((s) => s.trim()).filter(Boolean) : [];
};

const APPLY = has('--apply');
const CONFIRMED = has('--yes');
const softDelete = listArg('soft-delete');
const only = listArg('only');

const TARGET = process.env.CANDANGO_TARGET_DATABASE_URL;
if (!TARGET) {
  console.error('CANDANGO_TARGET_DATABASE_URL is not set. Pass the target database explicitly — this script is meant to be pointed at production on purpose, never by default.');
  console.error('(It intentionally ignores DATABASE_URL, which Prisma auto-loads from any .env in scope.)');
  process.exit(1);
}
if (APPLY && !CONFIRMED) {
  console.error('--apply also requires --yes. Re-read the inventory above it first.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: TARGET } } });
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

async function main() {
  // Redact the credentials but show which host we're about to touch — the one detail worth
  // double-checking before an --apply.
  const host = (TARGET.match(/@([^/?]+)/) || [, '(unparsed)'])[1];
  console.log(`\nTarget: ${host}`);
  console.log(APPLY ? 'Mode:   APPLY — rows will be deleted\n' : 'Mode:   dry run — nothing will be written\n');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

    const orgs = await tx.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        users: { where: { deletedAt: null }, select: { email: true }, orderBy: { createdAt: 'asc' } },
        subscription: true,
        quickbooksConnection: { select: { id: true, realmId: true } },
        companyCamConnection: { select: { id: true } },
        _count: { select: { deals: true, persons: true, companies: true } },
      },
    });

    if (orgs.length === 0) {
      console.log('No organizations found. If that is a surprise, the RLS bypass did not take — check the DB user.');
      return;
    }

    console.log(`${orgs.length} workspace(s):\n`);
    for (const o of orgs) {
      const flags = [
        o.quickbooksConnection ? `QBO(realm ${o.quickbooksConnection.realmId})` : null,
        o.companyCamConnection ? 'CompanyCam' : null,
        o.subscription ? `Stripe(${o.subscription.status}${o.subscription.stripeSubscriptionId ? '' : ', no sub id'})` : null,
        o.deletedAt ? `soft-deleted ${fmt(o.deletedAt)}` : null,
      ].filter(Boolean);
      console.log(`  ${o.id}  ${o.name}`);
      console.log(`      plan=${o.plan}  created=${fmt(o.createdAt)}  deals=${o._count.deals} people=${o._count.persons} companies=${o._count.companies}`);
      console.log(`      users: ${o.users.map((u) => u.email).join(', ') || '(none)'}`);
      console.log(`      strands: ${flags.length ? flags.join('  ') : 'none'}`);
      console.log('');
    }

    const scope = only.length ? { orgId: { in: only } } : {};
    const targets = only.length ? orgs.filter((o) => only.includes(o.id)) : orgs;
    const toDelete = {
      quickbooks: targets.filter((o) => o.quickbooksConnection).length,
      companycam: targets.filter((o) => o.companyCamConnection).length,
      subscription: targets.filter((o) => o.subscription).length,
    };

    console.log('Stranded rows in scope:');
    console.log(`  QuickBooksConnection  ${toDelete.quickbooks}`);
    console.log(`  CompanyCamConnection  ${toDelete.companycam}`);
    console.log(`  Subscription          ${toDelete.subscription}`);
    if (only.length) console.log(`  (scoped to ${only.length} workspace(s) via --only)`);
    if (softDelete.length) console.log(`  Organizations to soft-delete: ${softDelete.length}`);
    console.log('');

    if (!APPLY) {
      console.log('Dry run — nothing written. Re-run with --apply --yes to delete the rows above.');
      return;
    }

    const qbo = await tx.quickBooksConnection.deleteMany({ where: scope });
    const ccam = await tx.companyCamConnection.deleteMany({ where: scope });
    const subs = await tx.subscription.deleteMany({ where: scope });
    console.log(`Deleted: QuickBooksConnection=${qbo.count}  CompanyCamConnection=${ccam.count}  Subscription=${subs.count}`);

    if (softDelete.length) {
      const missing = softDelete.filter((id) => !orgs.some((o) => o.id === id));
      if (missing.length) throw new Error(`--soft-delete names unknown workspace id(s): ${missing.join(', ')} — nothing was committed.`);
      const hidden = await tx.organization.updateMany({
        where: { id: { in: softDelete }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      console.log(`Soft-deleted ${hidden.count} workspace(s).`);
    }

    console.log('\nDone. Workspaces will need to reconnect QuickBooks/CompanyCam against the live provider apps.');
  });
}

main()
  .catch((e) => {
    console.error('\nFailed — the transaction rolled back, nothing was changed:\n', e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
