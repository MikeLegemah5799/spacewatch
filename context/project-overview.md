# Space Watch

## Overview

Space Watch is a web app that tracks rocket launches — historical and
upcoming — by aggregating data from NASA, SpaceX, and other providers into
one unified schedule. It's aimed at space enthusiasts and portfolio
reviewers who want a fast, live-feeling dashboard: a countdown to the next
launch, a searchable archive of past missions, and a forward-looking
schedule, all rendered through a distinctive dark, neon-blue "mission
control" interface built on the latest Next.js.

## Goals

1. Aggregate historical and upcoming launch data from Launch Library 2,
   SpaceX, and NASA into a single, normalized schedule.
2. Serve that data through fast, mostly-static server-rendered pages —
   without ever hitting rate-limited third-party APIs on the request path.
3. Demonstrate a modern Next.js 16 / React 19 architecture (server
   components, scheduled ingestion, layered caching) as a portfolio
   centerpiece.

## Core User Flow

1. User lands on the dashboard and sees the next upcoming launch, a live
   countdown, and headline stats (launches tracked, success rate, agencies).
2. User browses the historical archive, filtering by provider, status, or
   date range.
3. User opens a launch detail page for mission specifics, media, and (for
   SpaceX missions) booster/landing enrichment data.
4. User checks the schedule page for all upcoming launches ordered by NET
   (No Earlier Than date).
5. (Optional, auth-gated) User adds a launch to a personal watchlist.

## Features

### Dashboard

- Next-launch hero card with a live, ticking countdown and go/no-go status.
- Summary stats: launches tracked, success rate, upcoming in the next 30
  days, number of agencies.
- Preview list of upcoming launches with provider, NET, and status.

### Historical archive

- Full searchable, filterable list of past launches.
- Per-launch detail page: rocket, mission description, agency, pad location,
  outcome, imagery, webcast link.
- SpaceX-specific enrichment where available (cores, booster reuse, landing
  outcome), sourced from the archived SpaceX API as a best-effort backfill.

### Schedule

- Full list of upcoming launches ordered by NET, with status pills
  (`GO` / `TBD`).
- Per-agency pages listing that agency's launches.

### Data pipeline (not user-facing, but core to the product)

- Scheduled ingestion (Vercel Cron) normalizes all three providers into one
  `Launch` model and upserts into Postgres — the only path by which
  third-party data enters the app.
- Redis-cached hot values (next launch, dashboard stats) for fast reads
  between ingestion cycles.

## Scope

### In Scope

- Historical launch browsing and search.
- Upcoming launch schedule with live countdown.
- Data aggregation from Launch Library 2 (primary), SpaceX API (enrichment
  only), and NASA API (imagery only).
- Server-rendered dashboard, schedule, and historical pages on Next.js 16.
- Optional per-user watchlist behind Auth.js.

### Out of Scope

- Real-time launch webcast streaming or embedding beyond linking out.
- User-submitted launch data or corrections.
- Notifications/alerts (push, email, SMS) for launch changes — a possible
  future phase, not this one.
- Any direct, per-request call from the browser or a page render to LL2,
  SpaceX, or NASA APIs.

## Success Criteria

1. A visitor can see the next upcoming launch with an accurate, live
   countdown on the dashboard.
2. A visitor can search and filter the historical archive and open a launch
   detail page with correct provider-sourced data.
3. The schedule page reflects LL2 data no more than ~15 minutes stale, and
   never issues a live call to a rate-limited upstream on page load.
4. The historical archive includes SpaceX missions enriched with
   booster/landing detail where the archived SpaceX API provides it.
5. The UI matches the approved dark, neon-blue mockup: countdown, status
   pills, and stat cards render as designed.
