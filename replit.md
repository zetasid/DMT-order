# ZETAS

Fondasi aplikasi web responsif dan PWA untuk manajemen pesanan digital ZETAS.

## Run & Operate

- `pnpm --filter @workspace/zetas run dev` — run the ZETAS web app
- `pnpm --filter @workspace/zetas run typecheck` — check the ZETAS frontend
- `pnpm --filter @workspace/zetas run build` — build the ZETAS frontend
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push schema changes only to the dedicated development/test database
- No database is used by the demo UI. When persistence is added, `DATABASE_URL` must target a dedicated test/development database, never production.
- See `.env.example` for placeholders. Put real credentials in Replit Secrets, not source files.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TypeScript, wouter routing, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- PWA: web app manifest and service worker with static-asset-only caching

## Where things live

- `artifacts/zetas/src/` — app routes, UI, and demo fixtures
- `artifacts/zetas/public/` — PWA manifest, icon, offline page, and service worker
- `artifacts/zetas/docs/architecture.md` — architecture boundaries and current limitations
- `artifacts/api-server/src/modules/` — future auth and marketplace adapter contracts
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — Drizzle schema source of truth

## Architecture decisions

- Dashboard/order examples are static and clearly marked as demo data; they are not persisted.
- Auth and marketplace directories define extension boundaries only; no auth or marketplace integration is active.
- Offline behavior deliberately shows a generic connection message rather than serving cached order pages or private API data.

## Product

ZETAS is a multi-seller/multi-marketplace order-management platform in development. This first stage provides a responsive dashboard and navigable page shells only; it does not process real orders or connect stores.

## User preferences

- Build a new ZETAS project; do not import, copy, or modify any legacy ZETAS app/repository.
- Do not access or change any VPS production deployment or production database.
- Use only a dedicated development/test database for future persistence.
- Do not add marketplace APIs, order synchronization, or chat delivery in this stage.
- Keep the UI bright and readable with premium glass effects; avoid dominant bright navy and generic dashboard clutter.

## Gotchas

- Do not run the Drizzle schema push command until `DATABASE_URL` has been verified to point at the dedicated development/test database.
- Keep service-worker caching limited to static assets; never cache authenticated, order, chat, account, or API responses.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
