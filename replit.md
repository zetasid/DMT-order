# DMT

Fondasi aplikasi web responsif dan PWA DMT untuk manajemen pesanan digital.

## Run & Operate

- `pnpm --filter @workspace/zetas run dev` — run the DMT web app
- `pnpm --filter @workspace/zetas run typecheck` — check the DMT frontend
- `pnpm --filter @workspace/zetas run build` — build the DMT frontend
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/api-server run test` — run auth/tenant integration tests against a dedicated development/test database
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run generate` — generate a versioned migration after changing the schema
- `pnpm --filter @workspace/db run migrate` — apply reviewed migrations only to the dedicated development/test database
- `pnpm --filter @workspace/api-server run bootstrap-owner` — interactive, one-time Owner bootstrap; requires an already migrated development database and a TTY
- Docker/Dockge instructions are in `artifacts/zetas/docs/self-hosting-dockge.md`
- `DATABASE_URL` in Replit must target the dedicated development/test database, never production. Do not run tests or schema commands against production.
- See `.env.example` and `.env.docker.example` for placeholders. Put real credentials in Replit Secrets or the Dockge host's ignored `.env`, never in source files.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TypeScript, wouter routing, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundles)
- PWA: web app manifest and service worker with static-asset-only caching

## Where things live

- `artifacts/zetas/src/` — app routes, UI, and demo fixtures
- `artifacts/zetas/public/` — PWA manifest, icon, offline page, and service worker
- `artifacts/zetas/docs/architecture.md` — architecture boundaries and security decisions
- `artifacts/zetas/docs/self-hosting-dockge.md` — Dockge Compose, backups, restore, and multi-architecture validation
- `artifacts/api-server/src/modules/auth/` — local password hashing and identity contracts
- `artifacts/api-server/src/cli/` — explicit migration and single-run Owner bootstrap commands
- `lib/db/migrations/` — reviewed, versioned PostgreSQL migrations
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — Drizzle schema source of truth

## Architecture decisions

- Dashboard/order examples are static and clearly marked as demo data; they are not persisted.
- Authentication uses local email/password accounts, Node scrypt password hashes, PostgreSQL-backed server sessions, CSRF protection, and role/membership checks on the API.
- Owner is a single installation-wide account; each Seller has one tenant, and Operators are scoped through tenant memberships. The browser never supplies an authoritative role or active user ID.
- Tenant deletion is a soft deactivation. Account disabling revokes stored sessions.
- Marketplace APIs, real order synchronization, and chat delivery remain out of scope; dashboard/order fixtures are still explicitly demo-only.
- Offline behavior deliberately shows a generic connection message rather than serving cached order pages or private API data.

## Product

DMT is a multi-seller/multi-marketplace order-management platform in development. The current foundation includes local multi-tenant authentication and a responsive PWA; order and marketplace screens remain demo-only and are not connected to real stores.

## User preferences

- Continue in this DMT workspace; do not create or import another project.
- Do not access or change any VPS production deployment or production database.
- Use only a dedicated development/test database for future persistence.
- Do not add marketplace APIs, order synchronization, or chat delivery in this stage.
- Keep the UI bright and readable with premium glass effects; avoid dominant bright navy and generic dashboard clutter.

## Gotchas

- Generate and review additive migrations before applying them. Never run migration or test commands against production.
- Keep service-worker caching limited to static assets; never cache authenticated, order, chat, account, or API responses.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
