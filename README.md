# Candango

Sales CRM by **BSB Tech Hub** — a multi-tenant, Pipedrive-style pipeline manager.
(All BSB Tech Hub authorial apps are named after Brasília — a *candango* is one of the
workers who built the city.)

Design docs live in the Obsidian vault **Project Notes** under `SalesCRM/`.

## Monorepo layout
```
apps/
  web/        Next.js (App Router) + Mantine frontend   ← scaffolded (UI-0)
  api/        NestJS REST API                            (planned)
  workers/    BullMQ background workers                  (planned)
packages/     shared types / config                      (planned)
```

## Frontend stack
Next.js + React 19 + TypeScript + **Mantine** · TanStack Query · Zustand · dnd-kit.

## Getting started

### Frontend only (mock data)
```bash
npm install          # installs all workspaces
npm run dev          # starts apps/web on http://localhost:3000
```

### Full stack (real API + Postgres)
Requires a local PostgreSQL 16 (Docker `docker compose up -d`, or Homebrew below).

```bash
# 1) Postgres via Homebrew (one-time)
brew install postgresql@16
brew services start postgresql@16
createdb candango
brew install redis && brew services start redis   # for webhook delivery (BullMQ queue)

# 2) API env + schema
cp apps/api/.env.example apps/api/.env       # then set DATABASE_URL
#   e.g. DATABASE_URL="postgresql://$USER@localhost:5432/candango?schema=public"
npm --prefix apps/api run prisma:migrate     # applies migrations + generates client

# 3) Run
npm --prefix apps/api run start              # API on http://localhost:4000/v1
npm --prefix apps/web run dev                # web on http://localhost:3000
```
Smoke test: `curl http://localhost:4000/v1/health`

## Status
- [x] UI-0 — Frontend Foundation (app shell, theme, providers, data layer)
- [ ] UI-1 — Auth & Onboarding
- [ ] UI-2 — Core CRM
- [ ] UI-3 — Settings & Admin
- [ ] UI-4 — Reporting
