# @tex/api

Express API on Bun, organized as service modules behind a gateway
composition root (`src/app.ts`). Auth is Google OAuth only via Better Auth,
backed by Postgres + Drizzle (`docker-compose.yml`).

```bash
bun install             # run from the repository root
cp .env.example .env   # then fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
bun run db:up           # start Postgres (host port 5433 — 5432 is taken locally)
bun run db:migrate      # apply SQL migrations from ./drizzle
bun run dev             # start with hot reload (http://localhost:8000)
```

Production runs the bundled artifact: `bun run build && bun run start`.

Cloudflare deployment is separate from the local Bun process. Configure the
Hyperdrive ID and R2 bucket in `wrangler.jsonc`, set production secrets with
Wrangler, then run `bun run cf:deploy`. The full rollout, migration, and
rollback checklist is in [`docs/cloudflare-deployment.md`](../../docs/cloudflare-deployment.md).

One-liner for a fresh checkout: `bun run db:setup` (starts Postgres,
waits healthy, applies migrations).

Schema workflow (after changing Better Auth options in `src/lib/auth.ts`):

```bash
bun run auth:schema  # regenerate src/db/schema/auth.ts from Better Auth
bun run db:generate  # diff schema → new SQL migration in ./drizzle
bun run db:migrate   # apply pending migrations
```

Other helpers: `db:down`, `db:logs`, `db:reset` (wipe volume + restart),
`db:push` (prototype-only direct push, skips migration files),
`db:studio` (Drizzle Studio UI),
`verify:trello` (service-level integration suite, 34 checks, self-cleaning).
Run the verification suite with `RELAY_ENABLED=false` when a dev server is
already running, so the suite owns relay draining deterministically.

Google Cloud Console → APIs & Services → Credentials → OAuth client ID
(Web application), authorized redirect URI:

```text
http://localhost:8000/api/auth/callback/google
```

Key paths: `src/server.ts` (bootstrap), `src/app.ts` (gateway),
`src/lib/auth.ts` (Better Auth instance), `src/services/<name>/`
(one router per service), `src/config/env.ts` (typed env),
`src/db/schema/` (committed table definitions), `drizzle/` (SQL migrations).

## Trello API (all `/api/v1/*` require a session)

Auth model: org membership gates everything; outsiders get 404 (never 403)
for org-scoped ids. Hard deletes require admin + archived state.

```text
GET    /api/v1/organizations                    my orgs (+ role)
POST   /api/v1/organizations                    {name, slug} → creator becomes ADMIN
GET    /api/v1/organizations/:orgId             detail + myRole
PATCH  /api/v1/organizations/:orgId             rename (admin)
DELETE /api/v1/organizations/:orgId             cascade delete (admin)
GET    /api/v1/organizations/:orgId/members
PATCH  /api/v1/organizations/:orgId/members/:userId   {role} (admin, last-admin guarded)
DELETE /api/v1/organizations/:orgId/members/:userId   remove/leave (last-admin guarded)
POST   /api/v1/organizations/:orgId/invites     {email, role?} (admin; resend rotates token)
GET    /api/v1/organizations/:orgId/invites     (admin)
DELETE /api/v1/organizations/:orgId/invites/:inviteId (admin)
POST   /api/v1/organizations/invites/accept     {token} (email must match invite)

GET    /api/v1/boards?organizationId=…          list (?includeArchived)
POST   /api/v1/boards                           {organizationId, title}
GET    /api/v1/boards/:boardId                  full tree: lists → cards → assignees
PATCH  /api/v1/boards/:boardId                  {title?, archived?}
DELETE /api/v1/boards/:boardId                  (admin, archived first)

POST   /api/v1/lists                            {boardId, title, beforeOrder?, afterOrder?}
PATCH  /api/v1/lists/:listId                    {title?, archived?, boardId?} (same-org moves)
POST   /api/v1/lists/:listId/position           {beforeOrder, afterOrder}
DELETE /api/v1/lists/:listId                    (admin, archived first)

POST   /api/v1/cards                            {listId, title, description?, beforeOrder?, afterOrder?}
GET    /api/v1/cards/:cardId                    card + list/board + assignees + labels + comments + activity
PATCH  /api/v1/cards/:cardId                    {title?, description?, archived?, dueAt?, dueComplete?}
POST   /api/v1/cards/:cardId/move               {toListId, beforeOrder, afterOrder} (same org)
DELETE /api/v1/cards/:cardId                    (admin, archived first)
POST   /api/v1/cards/:cardId/assignees          {userId} (idempotent, member-only)
DELETE /api/v1/cards/:cardId/assignees/:userId
POST   /api/v1/cards/:cardId/labels             {labelId} (idempotent, same board)
DELETE /api/v1/cards/:cardId/labels/:labelId
GET    /api/v1/cards/:cardId/comments?limit&cursor
POST   /api/v1/cards/:cardId/comments           {text}
PATCH  /api/v1/cards/comments/:commentId        author only
DELETE /api/v1/cards/comments/:commentId        author or admin
GET    /api/v1/cards/:cardId/activities?limit&cursor   append-only feed

POST   /api/v1/labels                           {boardId, name?, color} (9-color palette)
PATCH  /api/v1/labels/:labelId                  {name?, color?}
DELETE /api/v1/labels/:labelId                  (tag rows cascade)

GET    /api/v1/me/reminders?days=7              my incomplete dated assignments, due soonest first
GET    /api/v1/me/tasks                         all my assignments with board/list context

GET    /api/v1/search?q=&limit=                 membership-scoped boards + cards + people

POST   /api/v1/realtime/ticket                  short-lived signed stream ticket (legacy clients)
GET    /api/v1/realtime/stream?boardId=          SSE board events (credentialed, membership-checked)

POST   /api/v1/checklists                       {cardId, title, beforeOrder?, afterOrder?}
PATCH  /api/v1/checklists/:checklistId          {title}
POST   /api/v1/checklists/:checklistId/position {beforeOrder, afterOrder}
DELETE /api/v1/checklists/:checklistId
POST   /api/v1/checklists/:checklistId/items    {text, assigneeUserId? (member-only)}
PATCH  /api/v1/checklists/items/:itemId         {text?, complete?, assigneeUserId?}
POST   /api/v1/checklists/items/:itemId/position
POST   /api/v1/checklists/items/:itemId/convert {toListId?} → card (carries assignee)
DELETE /api/v1/checklists/items/:itemId

POST   /api/v1/cards/:cardId/copy               {toListId?, title?} (deep copy, never a template)
POST   /api/v1/cards/:cardId/vote               toggle → {voted, votes}
PUT    /api/v1/cards/:cardId/fields             {fieldId, value} (type-coerced per definition)
DELETE /api/v1/cards/:cardId/fields/:fieldId
PATCH  /api/v1/cards/:cardId  …{coverColor?, coverAttachmentId?, storyPoints?, isTemplate?}
POST   /api/v1/cards/:cardId/attachments        multipart field "file" (10 MB, scripts blocked)

GET    /api/v1/attachments/:attachmentId/file   inline for images, download otherwise
DELETE /api/v1/attachments/:attachmentId        uploader or admin (nulls covers)

POST   /api/v1/fields                           {boardId, name, type, options?}
PATCH  /api/v1/fields/:fieldId                  {name?, options?} (type immutable)
DELETE /api/v1/fields/:fieldId                  (values cascade)
```

Conventions: positions are server-computed floats (`beforeOrder`/`afterOrder`,
`null` = open end); moves log `MOVED_CARD`-style activities transactionally;
deleted users tombstone to "Deleted user" in history.

Realtime: any successful Trello mutation fans out `board:updated` over SSE
via a post-response hook (`mutationNotifier`) — services stay unaware.
Single-process hub (`subscribeBoard`); swap the Map for Redis pub/sub when
scaling horizontally. Missed events are unrecoverable by design: clients
refetch on (re)connect.
