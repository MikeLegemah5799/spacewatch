# Space Watch

Space Watch is a rocket launch tracker: a live countdown to the next
upcoming launch, a full schedule (list or calendar), a searchable archive
of past missions, and per-agency pages — all aggregated from [Launch
Library 2](https://ll.thespacedevs.com/) into one normalized dataset and
served through a dark, neon-blue "mission control" UI.

The defining constraint is that upstream launch APIs are rate-limited (and
in one case, archived/read-only), so no page ever calls a third-party API
on the request path. A scheduled ingestion job is the only thing that
talks to LL2; every page reads from Space Watch's own Postgres database.

## Features

- **Dashboard** — next-launch hero with a live T-minus countdown and
  go/no-go status, headline stats, and a preview of upcoming launches.
- **Schedule** — the full upcoming-launch list, grouped by month, or a
  calendar view with day-by-day status chips. Both are plain server-
  rendered pages; only the countdown timer ships any client JavaScript.
- **Launches** — a searchable, filterable, paginated archive of past
  missions (provider, outcome, full-text search).
- **Agencies** — a directory of launch providers with per-agency stats
  and recent-launch history.

Not yet built (tracked in `context/progress-tracker.md`): SpaceX/NASA
enrichment data (booster reuse, landing outcomes, imagery) and an
auth-gated personal watchlist. There's no marketing landing page by
design — `/` redirects straight to `/dashboard`.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19 Server Components |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS v4, custom neon-blue "mission control" theme |
| Database | Postgres (built against [Neon](https://neon.tech)), via Drizzle ORM |
| Ingestion | Vercel Cron → [Launch Library 2](https://ll.thespacedevs.com/) → normalize → upsert |

See `context/ARCHITECTURE.md` for the full design (data flow, rendering
strategy, unified launch model) and `context/ui-context.md` for the design
system (colors, type, components).

## Getting started

### Prerequisites

- Node.js 20+
- A Postgres database (this project is built against [Neon](https://neon.tech),
  which needs both a pooled and a direct/unpooled connection string)

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with:

   ```bash
   DATABASE_URL=...           # pooled connection string — used at runtime
   DATABASE_URL_UNPOOLED=...  # direct connection string — used by Drizzle migrations
   CRON_SECRET=...            # any random string; guards the ingestion routes
   LL2_API_KEY=...            # optional — raises LL2's ~15 req/hour anonymous limit
   ```

3. Run the database migration:

   ```bash
   npx drizzle-kit migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — it redirects to
   `/dashboard`.

### Populating data

Ingestion normally runs on Vercel Cron (see `vercel.json`), not on any
request path, so a fresh database starts empty. To populate it locally,
trigger the two ingestion routes yourself:

```bash
# Upcoming launches (~15-minute cadence in production)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync

# Historical archive — paginated and resumable; re-run if it stops early
# (rate-limited or hit its per-run page cap) to pick up where it left off
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/backfill
```

Both call the real production LL2 API by default — mind the ~15/hour
anonymous rate limit (set `LL2_API_KEY` to raise it).

## Project structure

```text
app/
├─ dashboard/           # next-launch hero + stats (RSC)
├─ launches/            # historical archive: search/filter/paginate
├─ schedule/            # upcoming list + calendar views
├─ agencies/            # agency directory + per-agency detail
└─ api/
   ├─ cron/sync/        # schedule-sync ingestion (upcoming window)
   ├─ cron/backfill/    # historical backfill (paginated, resumable)
   └─ launches/         # JSON API backing the /launches filters
lib/
├─ providers/ll2.ts     # the only client allowed to call a launch API
├─ normalize.ts         # maps provider payloads → the unified schema
└─ db/                  # Drizzle schema, client, and query functions
components/              # shared UI (nav, status pills, stat cards, ...)
context/                 # architecture, design system, and progress docs
```

## Learn more

This app uses a spec-driven workflow — `context/project-overview.md`,
`context/ARCHITECTURE.md`, `context/code-standards.md`,
`context/ui-context.md`, and `context/ai-workflow-rules.md` define what to
build and how; `context/progress-tracker.md` tracks what's actually done,
what's next, and open questions. Read those before making architectural
changes.
