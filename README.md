# tex

Turborepo monorepo for the tex collaborative kanban application.

```text
apps/
  api/   Express API on Bun, Postgres, Drizzle, Better Auth
  web/   React client and Bun static host
packages/
  ...    Shared packages belong here when they have more than one consumer
```

## Development

Requirements: Bun `>=1.4.0` and Docker.

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run db:setup
bun run dev
```

The web app runs at `http://localhost:3000`; the API runs at
`http://localhost:8000`.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Run all development tasks through Turbo |
| `bun run build` | Build every application with Turbo caching |
| `bun run typecheck` | Typecheck every workspace |
| `bun run check` | Typecheck and build every workspace |
| `bun run db:setup` | Start Postgres and apply migrations |
| `bun run verify:trello` | Run the API service verification suite |

Run app-specific scripts with `bun run --cwd apps/api <script>` or
`bun run --cwd apps/web <script>`.

Database migrations, API details, and frontend routes are documented in the
respective app README files.

## Cloudflare

The production deployment plan and Wrangler setup are documented in
[`docs/cloudflare-deployment.md`](docs/cloudflare-deployment.md). The API uses
Workers Node compatibility, Hyperdrive, R2, and Cron; the web app deploys as
Workers Static Assets.
