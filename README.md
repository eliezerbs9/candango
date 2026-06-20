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
```bash
npm install          # installs all workspaces
npm run dev          # starts apps/web on http://localhost:3000
```

## Status
- [x] UI-0 — Frontend Foundation (app shell, theme, providers, data layer)
- [ ] UI-1 — Auth & Onboarding
- [ ] UI-2 — Core CRM
- [ ] UI-3 — Settings & Admin
- [ ] UI-4 — Reporting
