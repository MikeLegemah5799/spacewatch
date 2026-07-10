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
  go/no-go status, headline stats, and previews of both upcoming and
  recent launches.
- **Schedule** — the full upcoming-launch list, grouped by month, or a
  calendar view with day-by-day status chips. Both are plain server-
  rendered pages; only the countdown timer ships any client JavaScript.
- **Launches** — a searchable, filterable, paginated archive of past
  missions (provider, outcome, full-text search), each with its own
  detail page (mission facts, booster/landing data where available,
  other launches from the same provider).
- **Agencies** — a directory of launch providers with per-agency stats
  and launch history. Counts and lists include every launch an agency is
  a *stakeholder* in, not just ones it operated — a Crew Dragon mission
  shows up under NASA even though SpaceX flew the rocket.
- **Enrichment** — a daily pass tries to fill in SpaceX-specific booster/
  landing detail and NASA mission imagery. Both fail soft: SpaceX's API
  is currently fully offline (the code is correct and would resume
  working if it comes back), and NASA coverage is real but narrow
  (mission-name search, no hits for most routine commercial launches).

Not yet built (tracked in `context/progress-tracker.md`): an auth-gated
personal watchlist. There's no marketing landing page by design — `/`
redirects straight to `/dashboard`.

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
trigger the ingestion routes yourself:

```bash
# Upcoming launches
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync

# Historical archive — paginated and resumable; re-run if it stops early
# (rate-limited or hit its per-run page cap) to pick up where it left off
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/backfill

# Optional enrichment passes (safe to skip — both fail soft)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/enrich-spacex
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/enrich-nasa
```

All four call real third-party APIs by default — mind LL2's ~15/hour
anonymous rate limit (set `LL2_API_KEY` to raise it).

## Deploying to Vercel

1. Add the same environment variables from `.env.local` to the Vercel
   project's settings — they aren't read from a file you push, they have
   to be entered there directly. Use a freshly-generated `CRON_SECRET`
   for production rather than reusing a local dev value.
2. **If you're on the Hobby (free) plan**, cron jobs are capped at once
   per day, and a sub-daily cron expression fails deployment outright.
   `vercel.json` is already set to valid once-daily schedules for this
   reason — the schedule-sync route was originally designed for a
   ~15-minute cadence (see `ARCHITECTURE.md` §3), which needs a Pro (or
   higher) plan to actually run that often.
3. The database starts empty on first deploy. Trigger each cron route
   once manually (same `curl` commands as above, against the deployed
   URL) rather than waiting for the first scheduled run, if you want data
   showing immediately.

## Project structure

```text
app/
├─ dashboard/            # next-launch hero + stats (RSC)
├─ launches/
│  ├─ page.tsx           # historical archive: search/filter/paginate
│  └─ [slug]/            # launch detail
├─ schedule/             # upcoming list + calendar views
├─ agencies/
│  ├─ page.tsx           # agency directory
│  └─ [slug]/            # per-agency detail
└─ api/
   ├─ cron/sync/         # schedule-sync ingestion (upcoming window)
   ├─ cron/backfill/     # historical backfill (paginated, resumable)
   ├─ cron/enrich-spacex/ # SpaceX booster/landing enrichment (fail-soft)
   ├─ cron/enrich-nasa/  # NASA imagery enrichment (fail-soft)
   └─ launches/          # JSON API backing the /launches filters
lib/
├─ providers/            # ll2.ts (the only client allowed to block a
│                        # run), spacex.ts, nasa.ts (both fail soft)
├─ normalize.ts          # maps provider payloads → the unified schema
└─ db/                   # Drizzle schema, client, and query functions
components/               # shared UI (nav, status pills, stat cards, ...)
context/                  # architecture, design system, and progress docs
```

## Learn more

This app uses a spec-driven workflow — `context/project-overview.md`,
`context/ARCHITECTURE.md`, `context/code-standards.md`,
`context/ui-context.md`, and `context/ai-workflow-rules.md` define what to
build and how; `context/progress-tracker.md` tracks what's actually done,
what's next, and open questions. Read those before making architectural
changes.
