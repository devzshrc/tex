# Cloudflare Deployment Plan

This repository can run as two Cloudflare deployments:

* `tex-web`: a static-assets Worker serving the React SPA.
* `tex-api`: a Node-compatible Worker serving the existing Express API.

The recommended production data plane is:

```text
Browser -> tex-web (Workers Static Assets)
        -> tex-api (Workers + Express Node adapter)
        -> Hyperdrive -> managed PostgreSQL
        -> R2 -> attachment objects
        -> Cron -> outbox relay
```

## Findings

The current code had five deployment blockers:

1. The web production host was a Bun HTTP server, not a Cloudflare asset
   deployment.
2. The API process used `app.listen()` and a long-lived Bun process.
3. Attachments were written to local disk. Worker local storage is not a
   durable application data store.
4. The API started an infinite outbox polling timer. Workers must use a
   scheduled handler, Queue consumer, or Workflow for background work.
5. Realtime subscribers lived in a process-local `Map`. That is not shared by
   Worker isolates, so Cloudflare mode now polls durable realtime markers in
   PostgreSQL while keeping the existing in-memory path for local Bun.

## Cloudflare resources

Create these resources before production deployment:

* A managed PostgreSQL database. Keep PostgreSQL because the schema and
  migrations are already PostgreSQL-specific; connect it through Hyperdrive.
* One Hyperdrive configuration pointing at the database.
* One private R2 bucket for attachments.
* A custom domain for the web Worker, for example `app.example.com`.
* A custom domain for the API Worker, for example `api.example.com`.
* A production Google OAuth web client.
* A Workers Paid plan for production workloads. Validate request volume,
  database latency, and CPU usage before choosing a lower plan.

D1 is intentionally not part of this first deployment. Moving this schema to
SQLite would require a separate data migration, SQL dialect migration, and a
Better Auth adapter change. Revisit D1 only if the application outgrows the
single PostgreSQL database or needs database-per-tenant locality.

## Required secrets and variables

Set API secrets with Wrangler, never in `wrangler.jsonc`:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.jsonc
bunx wrangler secret put GOOGLE_CLIENT_ID --config apps/api/wrangler.jsonc
bunx wrangler secret put GOOGLE_CLIENT_SECRET --config apps/api/wrangler.jsonc
```

Configure these API variables in the production environment:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `BETTER_AUTH_URL` | `https://api.example.com` |
| `FRONTEND_URL` | `https://app.example.com` |
| `RELAY_ENABLED` | `true` |

`DATABASE_URL` is supplied by the Hyperdrive binding in Worker mode. Do not
put a raw database password in a committed vars file.

## Deployment order

1. Provision PostgreSQL and verify the production connection from a trusted
   machine.
2. Create Hyperdrive against that database and put its ID in
   `apps/api/wrangler.jsonc`.
3. Create the R2 bucket and put its name in `apps/api/wrangler.jsonc`.
4. Run migrations against the production database from a controlled CI job:
   `DATABASE_URL=<direct-admin-url> bun run --cwd apps/api db:migrate`.
5. Set the API secrets and replace the placeholder public URLs.
6. Deploy the API with `bun run cf:deploy:api`.
7. Add `https://api.example.com/api/auth/callback/google` to Google OAuth.
8. Set `BUN_PUBLIC_AUTH_URL=https://api.example.com` in the web build
   environment and deploy the web Worker with `bun run cf:deploy:web`.
9. Smoke-test `/health/live`, `/health/ready`, Google sign-in, an attachment
   upload/download, a board mutation, and two-browser realtime updates.
10. Promote the same immutable version from staging to production after the
    smoke tests pass.

## CI/CD gates

Every pull request should run:

```bash
bun install --frozen-lockfile
bun run check
bun run build
```

The deployment job should then run the API migration job, deploy the API,
deploy the web Worker, and run authenticated smoke tests. Keep migrations
backward-compatible with the previous application version so API and web
rollouts can overlap.

## Security and operations checklist

* Keep the R2 bucket private; attachments are authorized by the API before the
  object is read.
* Keep `credentials: include` on browser API requests and restrict CORS to the
  exact production web origin.
* Use HTTPS custom domains in production so Better Auth cookies are Secure.
* Enable Workers Logs and sample high-volume request logs if cost requires it.
* Add Cloudflare rate limiting/WAF rules for `/api/auth/*`, uploads, and search.
* Alert on 5xx responses, `/health/ready` failures, outbox backlog, and R2
  errors.
* Test restore of the PostgreSQL backup and verify R2 object recovery.
* Migrate any existing `uploads/` files to R2 before switching attachment
  traffic to the Worker.

## Known limits and follow-ups

The API still uses the existing Express route implementation through
Cloudflare's Node HTTP compatibility layer. This minimizes the first migration
and keeps the domain behavior stable. If bundle size, startup time, or Node
compatibility becomes a problem, the next step is a Hono route adapter, not a
domain rewrite.

The current 10 MB upload cap stays below Cloudflare's request-body limits and
the Worker memory limit, but the upload path buffers the file once in memory.
Move to direct browser-to-R2 multipart uploads before increasing the cap.

Realtime events are represented by short-lived durable markers in the existing
outbox table and are polled only in Cloudflare mode. Add a Durable Object
WebSocket hub if the product needs lower latency or very high concurrent
subscriber counts; the current SSE contract can remain as a fallback.

## Research references

These decisions follow the current Cloudflare documentation:

* [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
* [Node HTTP integration](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
* [Postgres with Hyperdrive and `pg`](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/)
* [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
* [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
* [Cloudflare storage choices](https://developers.cloudflare.com/workers/platform/storage-options/)
* [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
* [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
* [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
