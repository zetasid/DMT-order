# ZETAS foundation architecture

## Stack

- React + Vite + TypeScript for the responsive, installable web application.
- The existing shared Express API service for future server endpoints.
- OpenAPI as the API contract source, with generated React Query and Zod clients.
- Drizzle ORM and PostgreSQL tooling are present for future development/test persistence.

This first stage uses local, explicitly labeled demo fixtures for the dashboard and order screens. It does not read or write a database, call marketplace APIs, authenticate users, or synchronize conversations.

## Main boundaries

- `artifacts/zetas/src/` — web app routes, UI, and demo-only order fixtures.
- `artifacts/zetas/public/` — PWA manifest, icon, generic offline fallback, and conservative service worker.
- `artifacts/api-server/src/` — shared Express service mounted at `/api`; `/api/healthz` is currently the only endpoint.
- `artifacts/api-server/src/middlewares/` — reusable Zod request-body validation and a JSON error boundary; no business-data endpoint is exposed yet.
- `artifacts/api-server/src/modules/auth/` — provider contract for a future authentication integration; no local sign-in implementation.
- `artifacts/api-server/src/modules/marketplaces/` — provider-neutral adapter types kept outside core order UI/business code; no provider implementation.
- `lib/api-spec/openapi.yaml` — API contract source; regenerate clients after contract changes.
- `lib/api-zod/` and `lib/api-client-react/` — generated request validation and frontend API client.
- `lib/db/src/schema/` and `lib/db/drizzle.config.ts` — Drizzle schema and migration/push configuration.

## Environment and database safety

No database is required for the current demo-only UI, and no database schema or records were created. Before adding persistence, configure `DATABASE_URL` only for a dedicated development/test database. Never point development workflows or schema commands at production. `.env.example` contains placeholders only; actual credentials belong in Replit Secrets.

Once a test schema is intentionally added, the workspace command is `pnpm --filter @workspace/db run push`. It must only run with the dedicated test/development `DATABASE_URL`.

## Multi-seller direction (not implemented)

The next architecture stage should support multiple sellers in one installation, multiple marketplace stores per seller, and Owner/Seller/Operator roles. Future persistence and API authorization must enforce installation and seller ownership server-side. Marketplace credentials must be isolated per installation/store and supplied only to the relevant server-side adapter; they must never be exposed to the frontend or logged.

## Current limitations

Authentication, authorization enforcement, database tables, marketplace credentials, API endpoints for product data, chat, and logging of domain actions have not been implemented in this foundation stage. The shared API has structured request logging and a generic error boundary. No automated test suite is configured in the starter workspace.
