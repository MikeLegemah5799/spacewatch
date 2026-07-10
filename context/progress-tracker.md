# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- App shell (fonts, nav, theme) + the dashboard page, matching the
  approved mockup and reading live from Postgres.

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
- `lib/db/queries.ts` — added `getNextLaunch`, `getUpcomingLaunches`,
  `getDashboardStats` (read-only; `upsertLaunches` from ingestion was already
  there).
- `app/dashboard/page.tsx` — hero + stat grid + upcoming table, matches the
  mockup. Verified in a real browser (Playwright, screenshotted) both empty
  (no launches ingested yet) and with representative seed rows inserted
  temporarily for verification, then removed — the DB is empty again.
- `app/page.tsx` redirects to `/dashboard` (no marketing landing content is
  defined yet — see Open Questions).
- `app/launches`, `/schedule`, `/agencies` — placeholder pages using the same
  shell, so nav links resolve instead of 404ing.
- Added `--color-fail` / `--state-fail` token (see `ui-context.md`) — the
  mockup only showed GO/TBD, but `launches.status` also has `failure`.

## In Progress

- None — this unit (dashboard UI) is complete and verified end to end.

## Next Up

- Data pipeline: `lib/providers/ll2.ts`, `lib/normalize.ts`,
  `app/api/cron/sync/route.ts` — the only way real launch data will ever
  populate the dashboard (currently the DB is empty by design).
- `/launches` (historical archive + search/filter) and `/schedule` (full
  upcoming list) real implementations, replacing the current placeholders.
- `/agencies/[slug]` detail pages.

## Open Questions

- No marketing landing page content/design has been specified. `app/page.tsx`
  currently just redirects to `/dashboard` — confirm whether Space Watch
  needs a separate static landing page (per ARCHITECTURE.md §7) or whether
  the dashboard *is* the landing experience for this project.
- Nav's avatar icon is a generic placeholder (no Auth.js integration yet, per
  ARCHITECTURE.md §2 "Auth (optional)"). Decide when/if that gets built.

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

## Session Notes

- DB is Neon Postgres; `.env.local` has `DATABASE_URL` (pooled) and
  `DATABASE_URL_UNPOOLED` (direct, for `drizzle-kit`). Migration already
  applied — `drizzle/0000_great_night_thrasher.sql`.
- To resume: the DB is currently empty (no ingestion pipeline exists yet), so
  `/dashboard` renders its empty state until the "Next Up" data pipeline unit
  is built.
