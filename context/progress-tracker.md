# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- The `/schedule` page: full upcoming-launch list grouped by month, matching
  the approved mockup.

## Completed

- Drizzle schema migrated to the Neon database (`drizzle/0000_*.sql`).
- Root layout: Orbitron / Barlow / JetBrains Mono loaded via `next/font/google`,
  wired into the `--font-display` / `--font-sans` / `--font-mono` theme tokens.
- `components/app-shell.tsx`, `components/nav.tsx` — shared shell + top nav
  (active-link highlighting via a per-page `active` prop, no client JS needed).
- `components/countdown-timer.tsx` — client component, ticks the T-minus
  countdown on the dashboard hero.
- `components/status-pill.tsx`, `components/stat-card.tsx`.
- `lib/format.ts` — `getMissionName` (splits the ingested "rocket | mission"
  name) and `formatNet` (renders per `netPrecision`: day / month / quarter / year).
- `lib/db/queries.ts` — `getNextLaunch`, `getUpcomingLaunches`,
  `getDashboardStats` (dashboard reads); `upsertAgencies` (ingestion write,
  de-dupes by id within a batch — see Architecture Decisions).
- `app/dashboard/page.tsx` — hero + stat grid + upcoming table, matches the
  mockup.
- `app/page.tsx` redirects to `/dashboard` (no marketing landing content is
  defined yet — see Open Questions).
- `app/launches`, `/schedule`, `/agencies` — placeholder pages using the same
  shell, so nav links resolve instead of 404ing.
- Added `--color-fail` / `--state-fail` token (see `ui-context.md`) — the
  mockup only showed GO/TBD, but `launches.status` also has `failure`.
- `lib/providers/ll2.ts` — LL2 client: `fetchUpcomingLaunches`, typed to the
  fields normalize.ts consumes, with hand-rolled shape validation at the
  boundary (no schema-validation dependency added for one client). This is
  the only file allowed to fail the whole sync run.
- `lib/normalize.ts` — `normalizeAgency` / `normalizeLaunch`. Maps LL2's
  8 status ids → our 6-value `status` enum, and LL2's 17 `net_precision`
  values → our 6-value enum (always rounding to the next COARSER bucket, so
  displayed precision never overstates what LL2 actually knows).
- `app/api/cron/sync/route.ts` — the schedule-sync cadence only (~15 min,
  upcoming window). Verifies `CRON_SECRET` via `Authorization: Bearer`
  (Vercel Cron's convention), records each run in `sync_runs`.
- `vercel.json` — registers the `*/15 * * * *` cron schedule.
- Verified end to end: ran the route against the LL2 dev mirror
  (`lldev.thespacedevs.com`, used only to avoid burning the already-limited
  15/hr production quota during my own testing/research), confirmed 50
  launches + 18 agencies upserted, dashboard rendered them correctly
  (screenshotted), then deleted that data — the DB is empty again, ready
  for a real cron run against production LL2.
- `lib/db/queries.ts` — `getLaunchesSummary`, `getTopProviders`,
  `getLaunchesPage` (search/provider/outcome/sort/pagination against the
  historical archive — i.e. `isUpcoming = false`). Full-text search uses
  the existing `searchText` tsvector/gin index.
- `app/api/launches/route.ts` — client-filtering JSON endpoint per
  ARCHITECTURE.md §7, validates `outcome`/`sort` against known enums,
  clamps `page`/`pageSize` server-side (`getLaunchesPage` clamps
  regardless of what the route passes through).
- `components/launches-browser.tsx` — the one client component for this
  page (search box debounced 300ms, provider/outcome filter chips, sort
  select, table, pagination). Everything else on `/launches` is a Server
  Component.
- `app/launches/page.tsx` — replaces the placeholder from the dashboard
  unit; RSC fetches page 1 + summary + top-3-providers server-side, hands
  it to `LaunchesBrowser` as `initial` so there's no client round-trip on
  first paint.
- Verified end to end: seeded 10 historical launches across 4 providers
  (mixed success/failure) directly in Neon, screenshotted the default
  view, the Failure filter, and a "starlink" search — all matched
  expected results, no console errors. Caught and fixed a real bug this
  way: the route wasn't reading `pageSize` from the query string at all
  (always fell back to the default 20). Deleted the seed data afterward —
  DB is empty again.

- `lib/format.ts` — `formatSite` (LL2's full "Cape Canaveral SFS, FL, USA"
  → the schedule table's short "Cape Canaveral"; best-effort, see
  Architecture Decisions).
- `lib/db/queries.ts` — `getUpcomingCount(days)` extracted out of
  `getDashboardStats` (was inlined there) so `/schedule`'s "N launches in
  the next 30 days" header reuses the exact same computation instead of a
  second copy of the same `and(...)` condition. `getScheduleLaunches`
  returns every upcoming launch ordered by NET (nulls last) — no
  pagination, since ARCHITECTURE.md §5 calls this "RSC, revalidated," not
  a filtered/paginated view like `/launches`.
- `app/schedule/page.tsx` — fully a Server Component (no client JS at
  all): groups launches by calendar month of their `net` value (grouping
  is by the underlying stored date, not by `netPrecision` — a "Q4"-only
  launch still falls into whichever month its stored `net` lands in, same
  as the mockup showed for Artemis III appearing under a normal month
  header rather than its own "Q4" section), highlights the single
  soonest-NET row so the "next launch" concept carries over from the
  dashboard, and renders "List"/"Calendar" as static markup — "Calendar"
  is inert (no view exists yet, see Architecture Decisions).
- Verified end to end: seeded 6 upcoming launches spanning 3 different
  months (including one quarter-precision launch, Artemis III) directly
  in Neon, screenshotted — month grouping, the accent-vs-muted month
  header treatment, `formatSite`'s stripping of "SFS"/"SFB" suffixes, and
  the next-launch row highlight all matched the mockup. First attempt at
  the highlight used `bg-space-800`, which turned out visually
  indistinguishable from the table's own `bg-space-850` — switched to
  `bg-[--accent-fill]` (the same token already used for the SpaceX/live
  pill) and reverified. Deleted the seed data afterward — DB is empty
  again.

## In Progress

- None — this unit (`/schedule`) is complete and verified end to end.

## Next Up

- Historical backfill (daily, paginated, resumable via `sync_runs.cursor`) —
  a separate cadence/boundary from schedule-sync, deliberately not built
  yet. Also the only way `/launches` will have real (non-empty) data,
  since schedule-sync only ever writes `isUpcoming: true` rows.
- SpaceX enrichment pass (`lib/providers/spacex.ts`) and NASA imagery
  (`lib/providers/nasa.ts`) — both fail-soft, neither built yet.
- `/agencies/[slug]` detail pages.
- A real Calendar view for `/schedule` — the mockup shows a List/Calendar
  toggle, but no calendar-view design or behavior is specified anywhere
  in the context docs. Rendered as an inert, disabled-looking button for
  now rather than inventing a calendar UI. See Open Questions.
- Nothing currently flips `launches.isUpcoming` back to `false` once a
  launch's NET passes and LL2 drops it from `/launch/upcoming/` — schedule-
  sync only ever upserts with `isUpcoming: true`. Likely belongs with the
  backfill unit; flagged here so it isn't lost.

## Open Questions

- No marketing landing page content/design has been specified. `app/page.tsx`
  currently just redirects to `/dashboard` — confirm whether Space Watch
  needs a separate static landing page (per ARCHITECTURE.md §7) or whether
  the dashboard *is* the landing experience for this project.
- Nav's avatar icon is a generic placeholder (no Auth.js integration yet, per
  ARCHITECTURE.md §2 "Auth (optional)"). Decide when/if that gets built.
- No `LL2_API_KEY` is configured yet (anonymous tier: ~15 req/hour). Fine for
  one schedule-sync call at a time, but worth getting a free key before the
  15-minute cron is actually deployed, since dev/testing already used up a
  chunk of the hourly quota.
- What should "Calendar" on `/schedule` actually be? No design/behavior for
  it exists in any context file, only the toggle button in the mockup.
- Both the dashboard and schedule mockups show combined provider naming
  ("NASA · SpaceX") for multi-agency missions, but `providerName` currently
  only ever holds LL2's single `launch_service_provider` (see the existing
  Architecture Decision below) — recurring across two mockups now, worth
  deciding whether to join `mission.agencies` in the normalizer as its own
  unit, rather than continuing to treat it as a one-off simplification.

## Architecture Decisions

- Icons: implemented with `@tabler/icons-react` (SVG React components)
  rather than the `ti ti-*` webfont classes literally named in
  `ui-context.md`. Same icon set/style (Tabler, outline), but avoids pulling
  an external CDN webfont into the app — matches the project's existing
  "self-host everything" posture (`next/font`).
- The mockup's browser-chrome frame (traffic-light dots + address bar) is
  explicitly *not* part of the live app (`ui-context.md`); the outer
  `rounded-2xl` bordered card *is* ("Outer app frame" in the border-radius
  table), so `AppShell` renders that card directly on the `bg-void` page
  background, without the fake browser chrome.
- `providerName` reflects LL2's single `launch_service_provider` only (e.g.
  "SpaceX"), not all of `mission.agencies` (which can list multiple
  stakeholders, e.g. NASA + SpaceX on a Crew mission). Simpler and matches
  what LL2 considers the actual operator; joining in every mission
  stakeholder is a possible future enhancement, not required by the spec.
- Agency display name: LL2's `name` ranges from "SpaceX" to "National
  Aeronautics and Space Administration" with no field that's reliably both
  short and recognizable. Heuristic in `lib/normalize.ts`: prefer `abbrev`
  once `name` exceeds ~20 characters. Not a curated per-agency table, so a
  few (e.g. Roscosmos → "RFSA") will look less idiomatic than hand-picked
  copy would.
- `lib/db/queries.ts#upsertAgencies` de-dupes rows by `id` before the batch
  insert — a single sync batch has many launches from the same agency,
  and Postgres rejects an `ON CONFLICT DO UPDATE` batch with the same
  conflict key twice in one statement.
- `/launches`' provider quick-filter chips are the top 3 providers *by
  launch count* (`getTopProviders`), not a hardcoded list — the mockup
  showed SpaceX/NASA/ULA, but that's this dataset's top 3, not a fixed
  set the product depends on.
- Provider names on `/launches` are all rendered in the accent color
  (`text-neon-400`), matching the dashboard's table convention, rather
  than the mockup's apparent SpaceX-only highlighting — no rule for
  *which* providers should be highlighted was ever specified, so a
  consistent treatment for all rows was the safer read. (Same treatment
  carried into `/schedule`'s provider column for consistency.)
- `formatSite` takes everything before the first comma in
  `pad.location.name` and strips " SFS"/"SFB"/"AFB"/"AFS" suffixes — not a
  curated per-site lookup, so an unfamiliar site name will just show
  as-is rather than being shortened to whatever colloquial form a human
  would pick.

## Session Notes

- DB is Neon Postgres; `.env.local` has `DATABASE_URL` (pooled),
  `DATABASE_URL_UNPOOLED` (direct, for `drizzle-kit`), and `CRON_SECRET`
  (generated locally for testing — regenerate for production). Migration
  already applied — `drizzle/0000_great_night_thrasher.sql`.
- To resume: DB is currently empty. Run the cron route manually to populate
  it: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync`.
  No `LL2_API_BASE_URL` override is set by default, so this hits real
  production LL2 — mind the 15/hour anonymous rate limit.
