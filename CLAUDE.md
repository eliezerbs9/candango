# CLAUDE.md — Candango (code)

Multi-tenant, Pipedrive-style sales CRM. Monorepo: `apps/api` (NestJS + Prisma + Postgres), `apps/workers` (BullMQ consumers — webhook delivery + transactional email), `apps/web` (Next.js + Mantine v8).

The **product docs & requirements** live in the BSB Tech Hub Obsidian vault, alongside this repo:
`~/Projects/BSB Tech Hub/Project Notes/Candango/` — start by reading its `06 - Delivery/Progress Tracker.md` (source of truth for status) before non-trivial work.

## ⚠️ When you change behavior, update the requirements (in the vault)

**Whenever a change alters behavior, the data model, or the public API that is described in the vault's requirements, update those docs in the same change — don't let them go stale.** Specifically, check/update:

- `~/Projects/BSB Tech Hub/Project Notes/Candango/02 - Requirements/Functional Requirements.md` — edit the matching `FR-*` item, or add a new one (with a P0/P1/P2 priority + stable ID) for new capability. Never leave an FR asserting something now false.
- `~/Projects/BSB Tech Hub/Project Notes/Candango/02 - Requirements/User Stories.md` — add/adjust the story + its `(FR-x)` ref.
- The contradicted `04 - Features/*` note, `03 - Architecture/Data Model.md` (schema/relationships), and `05 - API/REST API Reference.md` (endpoints/payloads).
- `06 - Delivery/Progress Tracker.md` — flip statuses + add a one-line session-log entry.

Requirements describe *behavior*, not implementation status — keep done/in-progress/blocked in the Progress Tracker, not in the FR items. Rule of thumb: if someone reading only `02 - Requirements/` would be surprised by how the product now behaves, fix the requirements before calling the task done.

## ⚠️ Commit after each verified feature

**When a feature/step is implemented AND verified (relevant `tsc --noEmit` / build / smoke test pass), commit it in the same session — don't let work pile up uncommitted.** This rule is the standing authorization to commit without asking each time.

- **During development, work directly on `main`** — commit each verified feature straight to `main`; do **not** create feature branches for now, and keep all work merged into `main` (revisit this branching policy before production/release).
- **One logical commit per feature/step**, not a giant batch. Conventional Commits with an app scope: `feat(api): …`, `feat(web): …`, `feat(workers): …`, `docs: …`.
- Include the matching Prisma **migration** + `package.json`/lockfile changes in the same commit as the code that needs them.
- The **product-notes updates** now live in the BSB Tech Hub vault (`~/Projects/BSB Tech Hub/Project Notes/Candango/`), which is **not** part of this git repo — update those notes in the same session, but they are not committed here.
- End every commit message with the `Co-Authored-By` trailer (see harness rules).
- **Push only when explicitly asked** (committing is authorized by this rule; pushing is not).

## Dev workflow notes
- After a Prisma schema change: `cd apps/api && npx prisma migrate dev --name <name>` (regenerates the client). The running API process must be **restarted** to pick up the new client — `nest --watch` recompiles TS but keeps the old client in memory.
- Migrations are non-interactive here: if a migration would drop a column with data, clear that data first (it errors on the data-loss prompt otherwise).
- Don't run `next build` (production) while `next dev` is running in `apps/web` — it corrupts `.next` (missing vendor chunks). If it happens: stop dev, `rm -rf apps/web/.next`, restart `npm run dev`.
- Verify changes with `npx tsc --noEmit` (all apps) and `next build` (web); smoke-test API endpoints against the local server.
