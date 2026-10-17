# DMT application architecture

## Stack

- React + Vite + TypeScript for the responsive, installable web application.
- Express 5 for same-origin API endpoints.
- OpenAPI as the API contract source, with generated React Query and Zod clients.
- Drizzle ORM and PostgreSQL for accounts, tenant memberships, sessions, and audit events.
- Node's built-in scrypt for portable password hashing.

The dashboard and order screens still use explicitly labeled demo fixtures. The app now authenticates Owner, Seller, and Operator accounts and enforces tenant access in the API. It does not connect marketplace APIs, synchronize real orders, or send chats.

## Main boundaries

- `artifacts/zetas/src/` — web app routes, UI, and demo-only order fixtures.
- `artifacts/zetas/public/` — PWA manifest, icon, generic offline fallback, and conservative service worker.
- `artifacts/api-server/src/` — Express API mounted at `/api`, including sessions, auth, tenant and owner-only account routes.
- `artifacts/api-server/src/middlewares/` — session, active-account, owner-role, CSRF, path/body validation, and generic error handling.
- `artifacts/api-server/src/modules/auth/` — password hashing and shared identity contracts.
- `artifacts/api-server/src/cli/` — explicit migration runner and interactive Owner bootstrap.
- `artifacts/api-server/src/modules/marketplaces/` — provider-neutral adapter types; no provider implementation.
- `lib/api-spec/openapi.yaml` — API contract source; regenerate clients after contract changes.
- `lib/api-zod/` and `lib/api-client-react/` — generated request validation and frontend API client.
- `lib/db/src/schema/` and `lib/db/migrations/` — Drizzle schema and versioned migrations.

## Environment and database safety

Replit persistence and automated tests use only the dedicated development/test database. Never point development workflows, tests, or schema commands at production. `.env.example` contains placeholders; store Replit values in Secrets.

Generate migrations with `pnpm --filter @workspace/db run generate`, review the SQL, and apply explicitly with `pnpm --filter @workspace/db run migrate`. App startup never runs migrations. Do not use `push-force` or destructive schema commands.

The development/test auth integration test requires an isolated database with no existing Owner account. It creates uniquely named fixtures and removes only those fixtures afterward. The suite refuses `NODE_ENV=production`; still verify `DATABASE_URL` before running it.

## Authentication and tenant authorization

- Password hashes use scrypt (`N=32768, r=8, p=1`) with random salts; plaintext passwords are never stored or logged.
- The `zetas.sid` cookie is HttpOnly, SameSite=Lax, and Secure when the request is HTTPS. The server-side session store is PostgreSQL-backed and expires after eight hours.
- Mutating routes require a random session-bound CSRF token in `X-CSRF-Token`. The generated browser client keeps it in memory only; it is never put in localStorage.
- Login failures are generic and rate limited by IP and normalized email. Account status is re-checked from PostgreSQL on every authenticated request.
- The Owner role is globally unique. Sellers have a single tenant and seller membership; Operators are granted tenant memberships. All tenant reads and writes check the authenticated session and current membership in the API. The client-supplied role/user ID is never used for authorization.
- Disabling a user revokes their stored sessions. Tenant deletion is a soft deactivation; there is no destructive tenant delete route.
- PostgreSQL RLS was evaluated but is not enabled for this foundation: only identity and tenant metadata tables exist, and enabling RLS without consistently setting a trusted actor context in each transaction would create a false security boundary. Use server-side authorization now; evaluate RLS for future tenant business-data tables with dedicated policies and tests.

## Owner bootstrap and self-hosted Dockge

There is no public Owner registration or default password. After applying migrations, run `pnpm --filter @workspace/api-server run bootstrap-owner` in an interactive terminal; it refuses to create a second Owner and does not echo the password.

`compose.yaml` runs PostgreSQL, the API, and an Nginx static web server. The database has a named persistent volume and is not published on a host port. The web port binds to loopback for a TLS reverse proxy. Migrations and Owner bootstrap are opt-in one-shot Compose tools, never container-start hooks. See `self-hosting-dockge.md` for secrets, backup/restore, proxy, and multi-architecture build instructions.

The Docker build stage is pinned to amd64 because the current pnpm workspace lock excludes some ARM optional compiler packages. It produces architecture-independent assets; Node, Nginx, and PostgreSQL runtime images target the selected platform. An ARM-only builder needs amd64 emulation for that build stage. This workspace has no usable BuildKit runner: an unprivileged Docker daemon could start, but BuildKit could not mount its image layers. Compose syntax was validated; image builds have not been tested here.

## Remaining product scope

Future product-data and order endpoints must add tenant scoping and role checks server-side before exposing any records. Marketplace credentials must remain server-side and be isolated by installation/store. The current demo order screens are not connected to those future endpoints.
