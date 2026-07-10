# Code Standards

## General

- Keep modules small and single-purpose — a provider client, the normalizer,
  and the DB layer are separate files, not one "data" file.
- Fix root causes, do not layer workarounds. If LL2's rate limit is the
  problem, fix ingestion cadence — don't add a retry loop that hammers it.
- Do not mix unrelated concerns in one component or route. A page component
  renders; it does not fetch from third-party APIs directly.
- No user request may call a third-party launch API (LL2, SpaceX, NASA)
  directly. All external data flows through the cron ingestion path into
  Postgres — pages and route handlers only ever read from the database or
  Redis. This is the core architectural constraint of the project.

## TypeScript

- Strict mode is required throughout the project.
- Avoid `any` — use explicit interfaces or narrowly scoped types. External API
  responses are typed at the provider-client boundary before normalization.
- Validate unknown external input (every LL2/SpaceX/NASA payload) at the
  system boundary in `lib/providers/*` before it reaches `normalize.ts`.
- The canonical `Launch` type is inferred from the Drizzle schema
  (`typeof launches.$inferSelect`) — do not hand-maintain a duplicate
  interface elsewhere.

## Next.js

- Default to server components. Pages read directly from Postgres/Redis via
  the `lib/db` layer.
- Add `"use client"` only when browser interactivity requires it — currently
  that's the countdown timer, search/filter controls, and the optional
  watchlist toggle. Nothing else.
- Keep route handlers focused on a single responsibility: `/api/cron/sync`
  ingests, `/api/launches` serves client-side filtering. Neither does both.
- `/api/cron/sync` must verify the `CRON_SECRET` before running. It is the
  only route allowed to call third-party launch APIs.

## Styling

- Use the CSS custom property tokens defined in `ui-context.md` — no
  hardcoded hex values in components.
- Follow the border radius scale defined in `ui-context.md`.
- The neon-blue accent (`--accent-primary`) is reserved for live/active
  states — next-launch hero, countdown, "GO" indicators — not decoration.

## API Routes

- Validate and parse request input before any logic runs.
- Enforce auth and ownership before any mutation (relevant once the
  watchlist ships — a user may only add/remove their own rows).
- Return consistent, predictable response shapes across `/api/launches` and
  any future endpoint.

## Data and Storage

- Metadata belongs in the database — launch fields, agency info, sync run
  state, snapshot history.
- Large generated content (launch imagery, if ever cached rather than
  hotlinked) belongs in blob storage, not the database.
- Do not store large content directly in the database.
- The LL2 sync must never overwrite the `enrichment` JSONB column — that
  field is written only by the separate, fail-soft SpaceX enrichment pass.
- Every table row that originates from a third-party provider carries a
  `source` field. Provider-specific field mapping lives only in
  `lib/normalize.ts` — nothing downstream branches on source.

## File Organization

- `app/` — routes and pages (App Router). Server components by default.
- `app/api/` — route handlers: `cron/sync` (ingestion) and `launches`
  (client-facing query API).
- `lib/providers/` — one client per upstream API (`ll2.ts`, `spacex.ts`,
  `nasa.ts`). Each fails independently; only `ll2.ts` can block a sync run.
- `lib/normalize.ts` — the single place that maps provider payloads into the
  unified `Launch` shape.
- `lib/db/` — Drizzle schema, client, and query helpers.
- `lib/cache.ts` — Redis helpers for hot dashboard reads.
- `components/` — UI components (`CountdownTimer`, launch cards, status
  pills). Client components are named and scoped explicitly.
- `drizzle/` — generated migrations.
