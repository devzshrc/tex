# frontend

Trello clone client (Bun static host + React + TanStack Query + dnd-kit +
Tailwind + shadcn, Geist Mono throughout). Talks to the backend Trello API
(`src/lib/api.ts`) with the session cookie; auth via `src/lib/auth-client.ts`.

```bash
bun install          # install dependencies
cp .env.example .env # BUN_PUBLIC_AUTH_URL → backend base URL
bun run dev          # start with hot reload (http://localhost:3000)
bun run build        # production bundle into ./dist
```

Routes (tiny built-in router, `src/lib/router.ts`): `/` landing → `/signin`
→ `/o` workspaces → `/o/:orgId` boards + members + invites → `/b/:boardId`
board with drag-and-drop → `/b/:boardId/c/:cardId` card sheet (deep-linkable)
→ `/tasks` my tasks → `/invite/:token` join-by-link. Board drag state is
optimistic with server reconciliation; SSE (`src/lib/realtime.ts`) refetches
on collaborators' changes with a live/reconnecting indicator.

Design: warm paper/ink neutrals + signal-orange primary, Geist Mono
throughout, shadcn-only primitives (`src/components/ui`), shared patterns
in `src/components/shared` (Logo, EmptyState, PageHeader, ConfirmButton,
NotFoundCard). Dark mode via next-themes class strategy.
