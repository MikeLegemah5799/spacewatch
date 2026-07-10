# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- SpaceX enrichment pass (`lib/providers/spacex.ts`, `app/api/cron/enrich`)
  — cores/booster-reuse/landing data per ARCHITECTURE.md §3.

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
- `app/page.tsx` redirects to `/dashboard` — confirmed final (not a
  placeholder): there is no marketing landing page in scope, the
  dashboard is the entry point. `ARCHITECTURE.md` §5/§7 updated to match.
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

- `lib/db/queries.ts` — `getAgenciesList` (all agencies + launch count via
  `leftJoin`/`groupBy(agencies.id)` — relies on Postgres's primary-key
  functional-dependency rule to select non-aggregated columns), `getAgencyBySlug`,
  `getAgencyStats` (total + success rate, same shape as the dashboard's),
  `getAgencyLaunches` (most recent 20, upcoming and past mixed, newest
  NET first — not the full search/filter/paginate treatment `/launches`
  gets, since one agency's launches are a small slice of the archive).
- `app/agencies/page.tsx` — replaces the placeholder; card grid, most
  launches first, links to each agency's detail page.
- `app/agencies/[slug]/page.tsx` — new route. Async `params` (Next 16
  convention), calls `notFound()` for an unknown slug.
- `app/not-found.tsx` — added because testing the 404 path above exposed
  a real gap: Next's default 404 is a plain white page with zero relation
  to this app's dark theme. Made `Nav`/`AppShell`'s `active` prop optional
  (`NavActive | undefined`) so a themed not-found page can render the
  shell with no tab highlighted.
- Verified end to end: seeded 4 agencies (SpaceX, NASA, ULA, Rocket Lab)
  and 9 launches split across them (mixed upcoming/past, mixed outcomes),
  screenshotted the list grid, an agency detail page (stats + recent
  launches correctly newest-first), a 404 for an unknown slug (confirmed
  themed, no nav tab highlighted, no console errors), then deleted the
  seed data. One seeding artifact worth noting: I inserted NASA's full
  legal name directly to test card-layout wrapping, which doesn't reflect
  real data — `normalizeAgency` always shortens it before it ever reaches
  the DB, so production agency names never look like that.

- `lib/providers/ll2.ts` — `fetchPreviousLaunches(pageUrl?)`, paginating
  `/launch/previous/`. Refactored the shared fetch+validate logic out of
  `fetchUpcomingLaunches` into one `fetchLaunchList` helper both use.
  Added `LL2RateLimitError` (thrown specifically on HTTP 429) so callers
  can distinguish "rate-limited, resume later" from a hard failure.
  The resumable cursor is just LL2's own `next` URL (already encodes
  offset/limit/mode) rather than an offset I'd have to track myself.
- `lib/normalize.ts` — `normalizeLaunch` now takes an explicit
  `isUpcoming: boolean` parameter instead of hardcoding `true`. It's set
  by which endpoint the caller fetched from (schedule-sync passes `true`,
  backfill passes `false`), not inferred from `raw.status` — confirmed via
  real data that LL2's `/previous/` list can include a launch whose NET
  has passed but whose status is still "Go" (not yet updated to a
  terminal outcome), so trusting the endpoint is what keeps `isUpcoming`
  meaning "which cron saw this," consistently.
- `app/api/cron/backfill/route.ts` — new cron, separate cadence from
  schedule-sync. Resumes from the last incomplete run's cursor (or starts
  fresh), loops pages up to `MAX_PAGES_PER_RUN = 10` per invocation
  (anonymous LL2 is ~15 req/hour; staying under that leaves headroom for
  schedule-sync's own calls), and stops — saving the cursor, not erroring
  — on: full drain (`next === null`), the page cap, or a 429. A run that
  already finished successfully short-circuits immediately instead of
  re-walking from page one (harmless but wasteful, since upserts are
  idempotent and LL2 orders `/previous/` newest-first anyway — see the
  Open Question about catching up newly-completed launches). Added
  `maxDuration = 60` (route segment config) since one invocation makes up
  to 10 sequential upstream requests.
- `vercel.json` — added the `0 3 * * *` daily backfill cron alongside the
  existing 15-minute schedule-sync one.
- Verified end to end against the LL2 dev mirror (production quota was
  down to its last request from earlier research, not worth risking):
  first invocation drained all 350 available launches in 7 pages and
  returned `done: true`; a second invocation correctly short-circuited
  with "already complete" instead of re-fetching; `sync_runs` showed the
  single completed row with `cursor` cleared; `/launches` (built two
  units ago) immediately reflected the real ingested data — 350 launches,
  29 real agencies, real provider quick-filter chips (SpaceX/CASC/Rocket
  Lab, not the old seeded SpaceX/NASA/ULA) — with zero code changes to
  that page, confirming it was truly reading from the DB and not
  coupled to my earlier test fixtures. Deleted the data afterward — DB
  is empty again, ready for a real run.

- `components/status-pill.tsx` — exported `STATUS_CONFIG` (was
  module-private) so the calendar's day chips reuse the exact same
  status→color mapping instead of a second copy.
- `lib/db/queries.ts` — `getScheduleLaunchesForMonth(year, month)`, a
  UTC calendar-month-scoped query (0-indexed month, matches
  `Date#getUTCMonth`) — a real DB-level query rather than filtering the
  full upcoming list client-side, consistent with how every other page
  pushes filtering into the query layer.
- `components/schedule-list.tsx` — extracted the List view's rendering
  (and its `groupByMonth` helper) out of `app/schedule/page.tsx` verbatim,
  now taking `rows` as a prop.
- `components/schedule-calendar.tsx` — new. Month grid with leading *and*
  trailing blank cells (padded to a full 7-column last row — the first
  attempt only padded leading blanks, which left the grid's rounded
  corner clipping oddly over an implicit empty grid cell after day 31;
  fixed and reverified), day chips colored via the shared `STATUS_CONFIG`
  and labeled with the full `getMissionName` (CSS `truncate`, not a
  bespoke abbreviation — the mockup's shortened chip text, e.g. "Starlink
  12-9" for "Starlink Group 12-9", reads as mockup shorthand rather than
  a spec'd truncation rule), a max of 3 chips per day plus a "+N more"
  overflow, and a ring highlight + bold day number for today. Prev/next
  month navigation is plain `<Link>`s with a `?month=YYYY-MM` param — no
  client JS.
- `app/schedule/page.tsx` — now reads `searchParams` (`view`, `month`) to
  choose List vs. Calendar and, for Calendar, which month; both are still
  Server Components fetching their own data, so the whole page remains
  client-JS-free. Refined the List/Calendar toggle to match this mockup's
  treatment more closely than the placeholder from the prior unit: active
  = solid `bg-neon-400` fill with dark text, inactive = muted border —
  applied to *both* tabs now, superseding the border-only "active" style
  the List-only version used before a Calendar mockup existed to compare
  against.
- Verified end to end: seeded 8 upcoming launches across July/August 2026
  (mixed go/tbd) directly in Neon, screenshotted the calendar for the
  current month (day chips, today's ring+bold highlight, legend) and
  after navigating to next month (correctly empty of highlight, shows the
  one seeded August launch), and the List view to confirm the shared
  toggle refactor didn't regress it. No console errors. Deleted the seed
  data afterward — DB is empty again.

- **Real finding that changed this unit's scope**: the SpaceX API v4
  (`api.spacexdata.com`) isn't just "archived/read-only" as
  ARCHITECTURE.md described — every endpoint returns a Cloudflare 525
  (origin unreachable; confirmed via a successful TLS handshake, so it's
  not DNS/network on my end, the origin server itself is gone). Worse,
  the correlation field the architecture's design depended on
  (`r_spacex_api_id`) is null in every real LL2 response checked — dev
  mirror, production, and even for **CRS-20**, a mission I confirmed has
  a real entry in the SpaceX API's own public docs. Flagged this to the
  user before writing throwaway code; decision was to build it correctly
  anyway (as designed, effectively dead code today) rather than skip it
  or rip it out of scope.
- `lib/db/schema.ts` — added `launches.spacexApiId` (text, nullable,
  indexed) to store LL2's `r_spacex_api_id` — the correlation key the
  enrichment pass looks up by. Migration `drizzle/0001_*.sql`. Also added
  `spacexApiId` to `upsertLaunches`'s `onConflictDoUpdate` set (refreshed
  from LL2 like any other LL2-owned field, unlike `enrichment` which
  stays untouched by the LL2 upsert on purpose).
- `lib/providers/ll2.ts` — added `r_spacex_api_id` to the `LL2Launch`
  type; passed through in `lib/normalize.ts#normalizeLaunch`.
- `lib/providers/spacex.ts` — new client. Unlike `ll2.ts`, this one never
  throws: `fetchSpacexLaunch` returns `null` on any failure (network
  error, non-200, unexpected shape) so the caller doesn't need its own
  try/catch to get fail-soft behavior.
- `lib/normalize.ts` — `normalizeSpacexEnrichment`, mapping a SpaceX API
  v4 launch into the `enrichment` JSONB shape: `success` plus a curated
  per-core subset (flight, reused, gridfins, legs, landing attempt/
  success/type) — not the full payload (imagery/press links are out of
  scope for this pass).
- `lib/db/queries.ts` — `getLaunchesNeedingSpacexEnrichment` (rows with
  `spacexApiId` set and `enrichment` still null, batched at 20),
  `setLaunchEnrichment` (a targeted single-column update, never touching
  any LL2-owned field).
- `app/api/cron/enrich/route.ts` — new cron, separate cadence again. Its
  `ok` reflects whether the *pass* ran, not whether every launch got
  enriched — per-launch failures (today, that's all of them) are
  expected and logged via a `summary` string in `sync_runs.error`. Added
  to `vercel.json` at `30 3 * * *` (30 min after the daily backfill).
- Verified end to end, in two parts, since the real API is down:
  (1) fail-soft path against the actual dead API — seeded one launch
  with a real `spacexApiId`, ran the route, got `{enriched: 0,
  attempted: 1}` with no crash and `ok: true`.
  (2) the parsing/write path — stood up a throwaway local HTTP server
  serving the exact CRS-20 fixture JSON from the SpaceX API's own public
  docs, pointed `SPACEX_API_BASE_URL` at it, re-ran the route, and
  confirmed the DB row's `enrichment` column exactly matched the fixture
  (flight 2, reused, RTLS landing) — real parsing logic, verified against
  real (if no longer live) data, not a hand-wavy unit test. Re-ran a
  third time to confirm an already-enriched row is correctly excluded
  from the next batch. Deleted all seed data and the mock server
  afterward.
- `ARCHITECTURE.md` §3 updated to state the SpaceX API is fully offline
  (not just read-only) and that the correlation field is unpopulated in
  practice, so this reads as confirmation of the architecture's own
  stated fallback ("the app degrades to LL2-only detail...") rather than
  a contradiction of it.

## In Progress

- None — this unit (SpaceX enrichment pass) is complete and verified end
  to end, within the constraints of a dead upstream API.

## Next Up

- NASA imagery enrichment (`lib/providers/nasa.ts`) — not built. Genuinely
  ambiguous, not just unbuilt: ARCHITECTURE.md says "imagery enrichment
  (e.g. APOD, mission imagery)," but APOD (NASA's daily astronomy
  picture) has no inherent connection to a specific launch, and there's
  no schema field or mapping mechanism defined for it the way SpaceX
  enrichment had `enrichment` + `r_spacex_api_id`. Needs a scoping
  decision before implementation, same as the Calendar view did last
  unit — see Open Questions.
- No UI anywhere surfaces `launches.enrichment` yet — there's no launch
  detail page at all (`/launches/[id]` is in ARCHITECTURE.md §7's
  project structure but was never built; `/launches` is list-only so
  far). Enrichment data will sit unused in the database until that page
  exists.
- Nothing currently flips `launches.isUpcoming` back to `false` once a
  launch's NET passes and LL2 drops it from `/launch/upcoming/`.
  Schedule-sync only ever upserts `isUpcoming: true`; backfill only ever
  upserts `isUpcoming: false`; neither one *transitions* an existing row.
  In practice a launch will get corrected the first time backfill's
  pagination reaches it post-completion, but there's a window where a
  launch that's actually happened still shows as upcoming.
- Related: once a full backfill completes, there's no mechanism to catch
  up *newly*-completed launches going forward — the route as built only
  handles "drain everything once." LL2 orders `/previous/` newest-first,
  so a small periodic "check the first page or two for anything not yet
  in our DB" pass is probably the right shape, but that's a distinct
  behavior from resumable pagination and deliberately not built here.
- `/agencies/[slug]`'s "Recent Launches" is capped at 20 with no
  pagination — fine while the DB is small, but will need it eventually
  for a prolific agency like SpaceX now that backfill is real.

## Open Questions

- Nav's avatar icon is a generic placeholder (no Auth.js integration yet, per
  ARCHITECTURE.md §2 "Auth (optional)"). Decide when/if that gets built.
- No `LL2_API_KEY` is configured yet (anonymous tier: ~15 req/hour). Getting
  one before deploying either cron for real is no longer just a nice-to-have
  — dev/testing across these units has repeatedly run the production quota
  down to its last request or two, and a real 15-minute schedule-sync cron
  plus a 10-page-per-run daily backfill will contend for the same ~15/hour
  ceiling once both are live.
- Both the dashboard and schedule mockups show combined provider naming
  ("NASA · SpaceX") for multi-agency missions, but `providerName` currently
  only ever holds LL2's single `launch_service_provider` (see the existing
  Architecture Decision below) — recurring across two mockups now, worth
  deciding whether to join `mission.agencies` in the normalizer as its own
  unit, rather than continuing to treat it as a one-off simplification.
- What should NASA "imagery enrichment" actually mean for a specific
  launch row? APOD is a daily picture unrelated to any mission; NASA's
  API doesn't have an obvious per-launch imagery endpoint the way the
  SpaceX API has per-launch cores. Options to consider: skip it (LL2
  already gives every launch an `imageUrl`); use it only for NASA-agency
  missions specifically; or something else — needs a decision before any
  code gets written, not an inferred behavior.

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
- Calendar month navigation is URL-param-based (`?view=calendar&month=YYYY-MM`)
  rather than client-state-based, so `/schedule` stays 100% Server
  Components — consistent with ARCHITECTURE.md §5 calling this page "RSC,
  revalidated," and with how `/launches` is the one page in this app that
  actually needed a client component (search debouncing can't be done any
  other way).
- Day chips cap at 3 per cell with a "+N more" overflow rather than
  growing the cell to fit every launch — not specified by the mockup
  (which never showed more than one launch on any single day), but a
  reasonable defensive default once real backfilled data means some days
  legitimately have many launches (e.g. Starlink cadence).

## Session Notes

- DB is Neon Postgres; `.env.local` has `DATABASE_URL` (pooled),
  `DATABASE_URL_UNPOOLED` (direct, for `drizzle-kit`), and `CRON_SECRET`
  (generated locally for testing — regenerate for production). Migration
  already applied — `drizzle/0000_great_night_thrasher.sql`.
- To resume: DB is currently empty. Populate it with
  `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync`
  (upcoming) and `.../api/cron/backfill` (historical). No `LL2_API_BASE_URL`
  override is set by default, so both hit real production LL2 — mind the
  15/hour anonymous rate limit, which this session has run close to empty
  more than once.
