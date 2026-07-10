# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- `/launches/[slug]` detail page, matching the approved mockup — the
  route ARCHITECTURE.md §7 always planned but never built, and the only
  place `launches.enrichment` gets surfaced in the UI.

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

- `lib/db/queries.ts#markMissedLaunchesAsHistorical` — flips any
  LL2-sourced row still `isUpcoming: true` whose NET has passed and which
  isn't in the batch schedule-sync just fetched. Doesn't touch `status`
  (still whatever non-terminal value LL2 last gave it, e.g. "go") —
  that's corrected separately by backfill's catch-up pass, once it
  reaches that launch.
- `app/api/cron/sync/route.ts` — calls the above after every upsert;
  response now includes `markedHistorical`.
- `app/api/cron/backfill/route.ts` — split into two modes. "Drain" is
  the original resumable full-archive walk, unchanged in behavior.
  "Catch-up" is new: once a prior run has fully drained (`ok: true` on
  record), instead of short-circuiting forever, check the first 2 pages
  of `/launch/previous/` (LL2 orders it newest-first, so this is a
  generous buffer against a missed daily invocation) and upsert them —
  picks up genuinely new completions and corrects `status`/`isUpcoming`
  for anything schedule-sync already flipped but couldn't fully correct.
  Shares one `ingestPage` helper between both modes now instead of
  duplicating the fetch/normalize/upsert sequence.
- Verified end to end against the LL2 dev mirror: (1) seeded a launch
  marked `isUpcoming: true` with a NET three days in the past and a
  status of "go" — one schedule-sync call correctly flipped it to
  `isUpcoming: false` (`status` left as "go", as designed) while leaving
  all 50 genuinely-upcoming launches from the fetch untouched. (2) ran
  backfill to a full drain (`mode: "drain"`, `done: true`), then twice
  more — both correctly took the `"catch-up"` path (100 launches/run,
  2 pages) rather than short-circuiting, and `sync_runs` shows all three
  runs recorded distinctly. Deleted seed data afterward.

- `lib/db/queries.ts` — replaced `getAgencyLaunches` (hard-capped at 20,
  no way to see older launches) with `getAgencyLaunchesPage(agencyId,
  page, pageSize)`, same shape/clamping convention as `getLaunchesPage`.
  Only one call site existed, so this was a clean replace, not a
  parallel API.
- `lib/format.ts` — extracted `getPageWindow` (the "up to 3 page numbers
  centered on current" helper) out of `components/launches-browser.tsx`,
  which had it as a locally-scoped duplicate. Now shared between that
  client component and the new server-rendered pagination here.
- `app/agencies/[slug]/page.tsx` — reads `?page=` from `searchParams` and
  renders Prev/page-numbers/Next as plain `<Link>`s (no client
  component) — same URL-param pattern as the schedule calendar's month
  navigation, appropriate here since there's nothing to filter *by* on a
  single-agency page, just pages to move through. Renamed the section
  from "Recent Launches" to "Launches" since it's the full paginated list
  now, not a preview, and added a "N total" count next to the heading.
- Verified end to end: seeded 27 launches for one agency (over the old
  20-cap), confirmed page 1 shows 20 with `Prev` disabled and `2`/`Next`
  available, page 2 shows the remaining 7 with `Next` correctly disabled,
  and reconfirmed `/launches` still works after the shared
  `getPageWindow` extraction. No console errors. Deleted seed data
  afterward.

- **Researched before building, same pattern as SpaceX**: `api.nasa.gov`
  (APOD, Mars Photos, DONKI — key-gated) has nothing that ties to a
  specific launch, contrary to what ARCHITECTURE.md implied. What
  actually works is the separate, unauthenticated **NASA Image and Video
  Library** (`images-api.nasa.gov`), confirmed live by real search
  requests: "Crew-9" → 7,495 hits (crew portraits/announcements, not
  precisely a liftoff photo); "Starlink Group 10-42" → 0 hits (NASA has
  no coverage of routine commercial launches, which is most of this
  app's data). Also found that the missions with the richest coverage
  (Commercial Crew) have `providerName: "SpaceX"` in our schema, not
  NASA, since that field reflects the rocket operator, not mission
  stakeholders — the same underlying gap as the recurring "NASA ·
  SpaceX" naming question. Presented all of this before writing code;
  user chose to search every launch and accept the coverage gaps as
  fail-soft, rather than wait on the `mission.agencies` join.
- `lib/providers/nasa.ts` — `searchNasaImage(query)`, fails soft like
  `spacex.ts` (returns `null`, never throws). No auth required.
- `lib/normalize.ts#normalizeNasaEnrichment` — always sets
  `nasaImageCheckedAt` (hit or miss), which is what
  `getLaunchesNeedingNasaImageCheck` looks for — without it, the ~100%
  of launches with no NASA coverage would get re-searched forever.
- **Real bug caught while building this, not by accident**: both
  enrichment passes write to the same `enrichment` JSONB column.
  `setLaunchEnrichment` (SpaceX's writer) did a blind overwrite — adding
  a second writer meant whichever pass ran second would silently erase
  the other's data, and the SpaceX candidate query's `enrichment IS
  NULL` filter would've falsely treated any NASA-checked launch as
  already-SpaceX-enriched. Replaced both: `mergeLaunchEnrichment` does
  an atomic `coalesce(...) || jsonb` merge (using `jsonb_exists(...)`
  rather than the `?` operator directly, which collides with
  bind-parameter placeholders in some Postgres drivers), and each
  candidate query now checks for its own namespaced key (`cores` for
  SpaceX, `nasaImageCheckedAt` for NASA) instead of "any enrichment at
  all."
- `app/api/cron/enrich-nasa/route.ts` — new cron, 50/run, same "`ok`
  means the pass ran, not that every launch matched" contract as
  SpaceX's. Renamed the SpaceX route's directory from `enrich` to
  `enrich-spacex` for symmetry (nothing was deployed yet, so a clean
  rename cost nothing). Added to `vercel.json` at `45 3 * * *`.
- Verified end to end against the real, live NASA API (unlike SpaceX,
  this one actually works): seeded three launches — a real CRS-20 row
  pre-populated with SpaceX's `cores` data, a NASA-affiliated "Artemis
  III," and a routine "Starlink Group 99-1." One run: Artemis III got a
  real image match ("Artemis III Crew Announcement"), Starlink correctly
  got `nasaImage: null` + a checked timestamp, and — the important part —
  CRS-20's pre-existing `cores`/`source` keys were untouched by the
  merge. Re-ran to confirm all three are now excluded from the next
  batch. Separately reconfirmed the SpaceX pass still works correctly
  after the query/merge refactor, using the same mock-fixture-server
  approach as before. Deleted all seed data afterward.

- **Scoped before building, same pattern as SpaceX/NASA enrichment and the
  Calendar view**: the mockup's "Booster & Landing" card showed a booster
  serial number (`B1082.6`) and a named droneship (`A Shortfall of
  Gravitas`) — neither of which our SpaceX enrichment stores. Both are
  UUID references (`core`, `landpad`) that would need *additional*
  per-launch API calls to resolve into human-readable names, against an
  API that's fully offline. Asked before building; user chose to show
  only what's already in hand (flight number, landing attempt/success/
  type, booster reuse) and add fairing reuse — free, since it's already
  in the single payload the client fetches, just wasn't parsed before.
  Skipped booster serial and droneship name entirely rather than
  showing empty/fake rows.
- Verified `mission.type` (LL2's field, e.g. "Communications," "Test
  Flight") is real and consistently populated via a live dev-mirror
  check, before adding it to the schema — it backs the subtitle's second
  segment ("Falcon 9 · Resupply"). The mockup showed a *third* segment
  (a spacecraft name, "Cargo Dragon") that LL2 doesn't reliably expose
  per launch; decided on my own to drop that segment rather than invent
  a shaky data source for it, since it's a much smaller gap than the
  booster/landing one and didn't seem worth a second question.
- `lib/db/schema.ts` — added `launches.missionType` (migration
  `drizzle/0002_*.sql`).
- `lib/providers/spacex.ts` — added `fairings` parsing (`reused`,
  `recovery_attempt`, `recovered`) from the same payload
  `fetchSpacexLaunch` already receives; `lib/normalize.ts` includes it in
  the enrichment shape.
- `lib/db/queries.ts` — `getLaunchBySlug`, `getMoreLaunchesFromAgency`
  (the "More from Provider" sidebar list, newest-first, excluding the
  current launch). Added `slug` to every launch-list query whose rows
  get linked to the detail page (dashboard, schedule list/calendar,
  `/launches`, agency detail) — six call sites.
- **Real bug found and fixed via testing, not assumption**: built the
  route as `/launches/[id]` first, matching ARCHITECTURE.md §7 verbatim.
  It 404'd. Isolated with a minimal reproduction (`id = "a:b"`) before
  concluding anything: a colon in a dynamic route segment 404s in this
  Next.js/Turbopack setup, in both raw and percent-encoded form — not an
  encoding bug on my end, a real router limitation. Our internal `id` is
  `"<source>:<externalId>"`, so this wasn't a one-off. Switched the whole
  route to `/launches/[slug]` instead (renamed the directory, the query
  function, and every linking call site) — `slug` was already unique and
  colon-free, so this sidesteps the bug rather than working around it.
- `app/launches/[slug]/page.tsx` — new. Hero (provider chip, status,
  title, rocket/mission-type subtitle, full date/time, pad location,
  decorative rocket icon), Mission description (with a placeholder for
  the ~100% of launches with none yet, matching current real data),
  Booster & Landing (only rendered when `enrichment.cores` exists — i.e.
  never yet, given the SpaceX situation; handles multi-core Falcon Heavy
  launches by rendering one block per core, not just the first), More
  From `<Provider>`, and a Mission Facts sidebar including a computed
  "Data source" (LL2 / LL2 + SpaceX / LL2 + NASA / all three, based on
  which enrichment keys are actually present — not hardcoded). Webcast
  button only renders when `webcastUrl` exists; "Add to watchlist" is an
  inert placeholder (no auth exists), same treatment as the Calendar
  toggle before it was real.
- Also wired mission names into links across the app — dashboard,
  `/launches`, `/schedule` (both List and Calendar), and agency
  detail — since a detail page nothing links to is undiscoverable.
- `lib/format.ts#formatFullDateTime` — the detail page's full date+time,
  precision-aware like `formatNet` but spelled out ("Jun 21, 2026 ·
  14:32 UTC") rather than terse, for a page where there's room for it.
- Verified end to end: seeded a fully-populated launch (SpaceX
  enrichment with cores + fairings, mission description, webcast,
  siblings for "More from SpaceX") and a minimal one (no enrichment, no
  description, no webcast, no pad) — screenshotted both; the minimal one
  correctly omitted every optional section/row rather than showing
  blanks. Confirmed the colon-routing fix with a real click-through test
  (Playwright clicking the actual rendered link on `/launches`, not just
  hitting the URL directly) — landed on the right page with the right
  data. Confirmed 404 for an unknown slug. Deleted all seed data
  afterward.

## In Progress

- None — this unit (`/launches/[slug]` detail page) is complete and
  verified end to end.

## Next Up

- A launch whose NET passes but LL2 is slow to drop it from
  `/upcoming/` (or that schedule-sync's own fetch window doesn't cover)
  won't get flipped until the *next* schedule-sync run notices it's
  missing — a small window, bounded by the ~15-min cadence, not
  eliminated. Acceptable for now; noting it so it isn't mistaken for a
  bug later.

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

## Architecture Decisions

- Launch detail is routed by `launches.slug`, not `launches.id` — a
  reversal of the original plan (`ARCHITECTURE.md` §7 said `[id]`,
  and `lib/normalize.ts` had a comment saying as much). Forced by a real,
  reproduced router limitation (colons in a dynamic segment 404), but
  also just better practice: slugs exist precisely to be URL-safe, so
  routing by them instead of an opaque `source:externalId` string is the
  right call independent of the bug that surfaced it.
- SpaceX enrichment's `enrichment.cores` is an array, not a single
  object, so the detail page renders one "Booster & Landing" block per
  core — Falcon Heavy's 3-core launches get 3 blocks, not just the
  first core silently dropped.
- "Data source" on the detail page is computed from which enrichment
  keys are actually present (`cores` → SpaceX, truthy `nasaImage` →
  NASA), not hardcoded per launch — stays correct automatically as
  enrichment coverage changes over time, including if the SpaceX API
  ever comes back online.

- NASA imagery enrichment searches by mission name for *every* launch,
  not just NASA-agency ones — deliberately, per user decision, rather
  than waiting on the `mission.agencies` join that would make "is this
  NASA-affiliated" answerable precisely. Coverage will be uneven (rich
  for Artemis/Crew missions, zero for routine commercial launches) and
  match precision rough (top relevance hit, not a curated liftoff photo)
  as a direct consequence — documented here so a future reader doesn't
  mistake the gaps for bugs.
- Both enrichment passes share one `mergeLaunchEnrichment` (atomic jsonb
  `||`) rather than each having its own update helper — the two passes
  writing to the same column is exactly the scenario that makes a shared,
  safe merge primitive worth it instead of two near-identical overwrite
  functions.
- Chose to detect "missed" launches (isUpcoming true, NET passed, not in
  the latest upcoming fetch) inside schedule-sync itself, rather than as
  a separate process — it's free (the data needed is already in hand
  from the fetch schedule-sync just did) and immediate (every ~15 min,
  not once a day). Backfill's catch-up pass is what actually corrects
  `status` to a terminal outcome; schedule-sync only ever flips
  `isUpcoming`, since it has no way to know what the outcome was.
- Backfill's "catch-up" mode checks a fixed 2 pages (100 launches),
  not a date-bounded window — simpler, and LL2's `/previous/` being
  strictly newest-first means a fixed page count is already equivalent
  to a time window in practice, just one that scales naturally with
  however many launches occur day to day.

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
