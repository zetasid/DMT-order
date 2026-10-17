# Self-hosting ZETAS with Docker Compose or Dockge

This deployment uses the Compose file at the repository root. It runs the ZETAS web UI, API, and PostgreSQL. No VPS was accessed or configured as part of this work.

## Before starting

- Use a Docker Engine with Docker Compose v2. Dockge can manage the root `compose.yaml`.
- Put a TLS reverse proxy in front of the web service. Compose publishes the web entrypoint only on `127.0.0.1`; the database and API have no published host ports.
- Keep the Dockge host's `.env` file private and outside version control.

## Configure secrets

Copy `.env.docker.example` to `.env` on the host and replace the placeholders. Generate two independent values:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Use the first 64-character hex value as `POSTGRES_PASSWORD` and in the password portion of `DATABASE_URL`. Use the second as `SESSION_SECRET`. Hexadecimal characters are URL-safe, so the connection string needs no additional encoding. Restrict the file to the deployment account, for example with `chmod 600 .env`.

Do not commit `.env`. Do not use Replit development credentials for the self-hosted database.

## First start

The database schema and first Owner are created explicitly. Migrations are never run automatically when a container starts.

1. Start PostgreSQL and wait for its health check:

   ```sh
   docker compose up -d db
   ```

2. Apply the reviewed, versioned migrations:

   ```sh
   docker compose run --build --rm migrate
   ```

3. Create the first Owner from an interactive terminal. The password is entered without echo and there is no default account or password:

   ```sh
   docker compose run --build --rm bootstrap-owner
   ```

4. Start the web and API services:

   ```sh
   docker compose up -d --build
   docker compose ps
   ```

The web service listens on `127.0.0.1:${APP_PORT:-8080}`. Configure the host's TLS reverse proxy to send traffic there. Sign in at `/login`; the Owner can then create Seller and Operator accounts.

For later schema changes, review the generated SQL first, then run `docker compose run --rm migrate`. Do not add a migration command to the API container's startup command.

## Health and database readiness

`/api/healthz` is a liveness check: it confirms that the API process can answer HTTP requests, but it does not contact PostgreSQL. `/api/readyz` runs a lightweight `SELECT 1` against PostgreSQL and returns HTTP 503 with only `{"status":"not_ready"}` if the database is unavailable. The API container health check uses `/api/readyz`, so a healthy API container also has a working database connection. Neither response exposes connection details or credentials.

## Reverse proxy and session security

The API trusts the number of proxy hops configured in `TRUST_PROXY_HOPS` (default `1`, for the Compose Nginx hop). Set it to the actual number of trusted proxies only when each proxy sanitizes and forwards `X-Forwarded-For` and `X-Forwarded-Proto`. Do not trust arbitrary client-supplied forwarding headers. The HTTPS proxy must forward `X-Forwarded-Proto: https`; the session cookie becomes Secure when the request is HTTPS.

If the outer TLS proxy is an additional trusted hop and is configured to overwrite forwarding headers, set `TRUST_PROXY_HOPS=2` in `.env` and recreate the API service. If the proxy chain is not configured safely, keep the default rather than trusting an unknown number of hops.

The API and database are only reachable on Compose's internal backend network. Do not publish PostgreSQL port 5432 or expose the API container directly to the internet.

## Backups and restore

Create a custom-format backup from the Postgres container. The `backups/` directory is ignored by Git:

```sh
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/zetas-$(date +%F-%H%M).dump
```

Check that the archive can be read:

```sh
docker compose exec -T db pg_restore --list < backups/zetas-YYYY-MM-DD-HHMM.dump
```

Restore into a new, empty database so the current database remains untouched:

```sh
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" zetas_restore'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d zetas_restore --no-owner --no-privileges --exit-on-error' < backups/zetas-YYYY-MM-DD-HHMM.dump
```

Review the restored data before changing the API connection string. Never use `pg_restore --clean` or restore over the active database as part of this procedure. Keep encrypted, off-host backup copies and test restores on a schedule; Compose does not schedule or upload backups.

## amd64 and arm64

The Node build stage is pinned to amd64 because the current workspace lock excludes some ARM optional compiler packages. It builds architecture-independent API bundles and static web files; the final Node and Nginx images use BuildKit's target platform. PostgreSQL uses its official multi-architecture image. An ARM-only Buildx host needs amd64 emulation for the build stage.

The Replit workspace used for this change has no usable BuildKit runner: an unprivileged Docker daemon started, but BuildKit could not mount image layers. Compose syntax was validated, but neither image architecture could be built or run here. Validate both targets on a Docker host or CI builder with Buildx; an ARM-only build host also needs amd64 emulation:

Create a container-backed Buildx builder if a suitable builder is not already selected:

```sh
docker buildx create --name zetas-multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

Then build both runtime targets:

```sh
docker buildx build --platform linux/amd64,linux/arm64 --target api --output=type=oci,dest=/tmp/zetas-api.oci.tar .
docker buildx build --platform linux/amd64,linux/arm64 --target web --output=type=oci,dest=/tmp/zetas-web.oci.tar .
```

These commands create local OCI archives and do not deploy or push images. The runtime image must still be tested on real amd64 and arm64 hosts before production use.

## Replit development database

Replit development and auth integration tests must use only the dedicated development/test `DATABASE_URL`. Review the migration SQL before applying it with:

```sh
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run test
```

The integration suite requires an isolated database without an existing Owner and removes only its uniquely named fixtures. Never run it, `generate`, or `migrate` against production.
