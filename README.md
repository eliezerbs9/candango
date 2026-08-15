# Candango

Sales CRM by **BSB Tech Hub** — a multi-tenant, Pipedrive-style pipeline manager
(estimates/invoices via QuickBooks, proposals, e-signature, automations, Google
Calendar/Gmail sync). All BSB Tech Hub authorial apps are named after Brasília — a
*candango* is one of the workers who built the city.

Product/requirements/architecture docs live in the Obsidian vault **Project Notes**
under `Candango/`. Start there at **Progress Tracker** for what's done / next / blocked.
This README is the source of truth for **running the code**.

## Monorepo layout
```
apps/
  web/        Next.js 15 (App Router) + React 19 + Mantine v8 frontend
  api/        NestJS REST API (Prisma + PostgreSQL, BullMQ producer)
  workers/    NestJS BullMQ consumers (email, webhooks, calendar/gmail sync, QBO refresh)
  mobile/     React Native app (excluded from the npm workspaces)
packages/     shared types / config (planned)
docker/
  documenso/  self-hosted Documenso e-signature stack (compose.yml + .env)
docker-compose.yml   postgres + redis + gotenberg
```

Node ≥ 20, npm (workspaces). Install once at the root: `npm install`.

---

## Local services — the full stack

| Service | Port | URL | How it runs | Needed for |
|---|---|---|---|---|
| **Web** (Next.js) | 3000 | http://localhost:3000 | `npm --prefix apps/web run dev` | always |
| **API** (NestJS) | 4000 | http://localhost:4000/v1 | `npm --prefix apps/api run start:dev` | always |
| **Workers** (BullMQ) | — | — | `npm --prefix apps/workers run start:dev` | email, webhooks, Google/QBO sync |
| **Postgres 16** | 5432 | localhost:5432 | Docker or Homebrew | always |
| **Redis 7** | 6379 | localhost:6379 | Docker or Homebrew | workers / BullMQ |
| **Gotenberg** | 3005 | http://localhost:3005 | `docker compose up -d gotenberg` | e-sign generated docs (HTML→PDF) |
| **Documenso** | 3060 | http://localhost:3060 | `docker compose -f docker/documenso/compose.yml --env-file docker/documenso/.env up -d` | e-signature engine |
| **cloudflared tunnel** | — | (random `*.trycloudflare.com`) | `cloudflared tunnel --url http://localhost:4000` | QuickBooks inbound webhook (dev) |

The web + API + workers are three long-running Node processes (run each in its own
terminal). Postgres/Redis/Gotenberg/Documenso are Docker containers. The tunnel is only
needed when testing QuickBooks webhooks against the Intuit sandbox.

---

## Getting started

### Frontend only (against a running API)
```bash
npm install
npm --prefix apps/web run dev          # http://localhost:3000  (needs the API up)
```

### Full stack — cold start

**1) Datastores** — Docker (recommended) starts Postgres, Redis and Gotenberg together:
```bash
docker compose up -d                   # postgres:5432, redis:6379, gotenberg:3005
```
…or Homebrew (Postgres/Redis only; run Gotenberg via Docker if you need e-sign docs):
```bash
brew install postgresql@16 && brew services start postgresql@16 && createdb candango
brew install redis && brew services start redis
```

**2) Env files** (copy the examples, then fill in — secrets never go in the vault):
```bash
cp apps/api/.env.example     apps/api/.env
cp apps/workers/.env.example apps/workers/.env
cp apps/web/.env.example     apps/web/.env.local
```
Minimum to boot: `DATABASE_URL` + `DIRECT_URL` + `JWT_SECRET` (api), matching
`DATABASE_URL`/`REDIS_URL` (workers), `NEXT_PUBLIC_API_URL=http://localhost:4000/v1`
(web). Google / QuickBooks / Stripe / Brevo / Spaces / Documenso are optional — each
feature degrades gracefully when its keys are absent. **`GOOGLE_TOKEN_ENC_KEY` must be
identical** in `apps/api/.env` and `apps/workers/.env` (else synced Google tokens can't
be decrypted by the worker).

**3) Database** — apply migrations + generate the Prisma client:
```bash
npm --prefix apps/api run prisma:migrate    # prisma migrate dev
# optional demo tenant (demo@candango.app / demo1234):
cd apps/api && node --env-file=.env prisma/seed-demo.mjs && cd -
```

**4) Run the three Node processes** (separate terminals):
```bash
npm --prefix apps/api run start:dev         # API  → http://localhost:4000/v1
npm --prefix apps/workers run start:dev     # workers (needs Redis)
npm --prefix apps/web run dev               # web  → http://localhost:3000
```

**5) Smoke test:** `curl http://localhost:4000/v1/health` → `{ "status": "ok", ... }`

### E-signature stack (optional — only when working on signatures)
```bash
docker compose up -d gotenberg              # HTML→PDF renderer (already up if you ran `docker compose up -d`)
docker compose -f docker/documenso/compose.yml --env-file docker/documenso/.env up -d
```
Then open http://localhost:3060, sign up, and in **Settings**:
- **API Tokens** → create one → put it in `apps/api/.env` as `DOCUMENSO_API_KEY`
  (with `DOCUMENSO_URL=http://localhost:3060`).
- **Webhooks** → add `http://host.docker.internal:4000/v1/public/documenso/webhook`
  (macOS needs `127.0.0.1 host.docker.internal` in `/etc/hosts`).

Documenso extras: Mailpit inbox at http://localhost:8025 (reads captured signing
emails); MinIO console at http://localhost:9001.

### QuickBooks inbound webhook (optional — only when testing QBO-side edits)
Intuit must reach your local API, so expose port 4000 with a quick tunnel:
```bash
cloudflared tunnel --url http://localhost:4000     # prints a https://<random>.trycloudflare.com URL
```
In the **Intuit developer dashboard**, set the webhook endpoint to
`https://<random>.trycloudflare.com/v1/public/quickbooks/webhook`, subscribe to
Estimate + Invoice events, copy the **Verifier Token** into `apps/api/.env` as
`QBO_WEBHOOK_VERIFIER_TOKEN`, then restart the API. (The URL changes each time you
restart the tunnel — update the dashboard accordingly.)

---

## Dev workflow notes
- **After a Prisma schema change:** `cd apps/api && npx prisma migrate dev --name <name>`
  (regenerates the client). **Restart the API** — `nest --watch` recompiles TS but keeps
  the old Prisma client in memory.
- **Verify with `npx tsc --noEmit`** in the changed app(s). **Do not run `next build`
  while `next dev` is running** — it corrupts `apps/web/.next` (symptom: "Cannot find
  module ./vendor-chunks/*"). Fix: stop dev, `rm -rf apps/web/.next node_modules/.cache`,
  restart `next dev`.
- **Workers queues:** `webhook-delivery`, `email`, `calendar-sync`, `gmail-sync`,
  `qbo-refresh`. They need Redis + the same DB/integration env as the API.
- Commit each verified feature to `main` (Conventional Commits), including its Prisma
  migration + lockfile in the same commit.

See `CLAUDE.md` (repo) for the full agent/dev conventions.
