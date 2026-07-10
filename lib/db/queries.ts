/* ==================================================================
 * Ingestion upsert  —  the shape lib/providers + normalize feed into
 * ================================================================== */

import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, ne, notInArray, sql } from "drizzle-orm";
import {
  agencies,
  db,
  launchAgencies,
  launches,
  type NewAgency,
  type NewLaunch,
  type NewLaunchAgency,
} from "@/lib/db";

export async function upsertAgencies(rows: NewAgency[]) {
  if (rows.length === 0) return 0;

  // A single sync batch has many launches from the same agency, which means
  // duplicate ids in one INSERT ... VALUES list. Postgres rejects that as
  // "ON CONFLICT DO UPDATE command cannot affect row a second time", so
  // de-dupe by id before the batch insert.
  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];

  await db
    .insert(agencies)
    .values(uniqueRows)
    .onConflictDoUpdate({
      target: agencies.id,
      set: {
        name: sql`excluded.name`,
        abbrev: sql`excluded.abbrev`,
        type: sql`excluded.type`,
        countryCode: sql`excluded.country_code`,
        externalId: sql`excluded.external_id`,
        updatedAt: sql`now()`,
      },
    });

  return uniqueRows.length;
}

/** Idempotent — the composite (launchId, agencyId) primary key means a
 * repeat run just no-ops on rows already there. Doesn't remove stale
 * links if a launch's stakeholder list changes upstream after the fact;
 * accepted as a known limitation (see progress-tracker.md) rather than
 * adding delete-then-insert complexity for an edge case that's rare in
 * practice. */
export async function upsertLaunchAgencyLinks(links: NewLaunchAgency[]) {
  if (links.length === 0) return 0;

  await db.insert(launchAgencies).values(links).onConflictDoNothing();
  return links.length;
}

export async function upsertLaunches(rows: NewLaunch[]) {
  if (rows.length === 0) return 0;

  await db
    .insert(launches)
    .values(rows)
    .onConflictDoUpdate({
      target: [launches.source, launches.externalId],
      set: {
        name: sql`excluded.name`,
        status: sql`excluded.status`,
        spacexApiId: sql`excluded.spacex_api_id`,
        net: sql`excluded.net`,
        netPrecision: sql`excluded.net_precision`,
        windowStart: sql`excluded.window_start`,
        windowEnd: sql`excluded.window_end`,
        isUpcoming: sql`excluded.is_upcoming`,
        padName: sql`excluded.pad_name`,
        padLocation: sql`excluded.pad_location`,
        imageUrl: sql`excluded.image_url`,
        webcastUrl: sql`excluded.webcast_url`,
        missionDescription: sql`excluded.mission_description`,
        searchText: sql`excluded.search_text`,
        updatedAt: sql`now()`,
        // NOTE: `enrichment` is deliberately NOT overwritten here.
        // The LL2 sync must never clobber SpaceX enrichment data,
        // which is written by a separate, fail-soft pass.
      },
    });

  return rows.length;
}

/**
 * Schedule-sync only ever upserts what LL2's `/upcoming/` list currently
 * contains — it never revisits rows that have quietly dropped off that
 * list because their NET has passed. This flips those: any LL2-sourced
 * row still marked `isUpcoming` whose NET is in the past and which isn't
 * in the batch just fetched has clearly happened. Its actual outcome
 * (success/failure, replacing whatever non-terminal status LL2 last gave
 * it) gets corrected later by the backfill cron's catch-up pass — see
 * ARCHITECTURE.md §3 and progress-tracker.md.
 */
export async function markMissedLaunchesAsHistorical(currentUpcomingIds: string[]) {
  const conditions = [eq(launches.isUpcoming, true), eq(launches.source, "ll2"), lt(launches.net, sql`now()`)];
  if (currentUpcomingIds.length > 0) {
    conditions.push(notInArray(launches.id, currentUpcomingIds));
  }

  const rows = await db
    .update(launches)
    .set({ isUpcoming: false, updatedAt: sql`now()` })
    .where(and(...conditions))
    .returning({ id: launches.id });

  return rows.length;
}

/* ==================================================================
 * Dashboard reads  —  app/dashboard/page.tsx
 * ================================================================== */

export async function getNextLaunch() {
  const [row] = await db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      rocket: launches.rocket,
      providerName: launches.providerName,
      net: launches.net,
      netPrecision: launches.netPrecision,
      status: launches.status,
      padName: launches.padName,
      padLocation: launches.padLocation,
    })
    .from(launches)
    .where(and(eq(launches.isUpcoming, true), isNotNull(launches.net)))
    .orderBy(asc(launches.net))
    .limit(1);

  return row ?? null;
}

export async function getUpcomingLaunches(limit = 4) {
  return db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      providerName: launches.providerName,
      net: launches.net,
      netPrecision: launches.netPrecision,
      status: launches.status,
    })
    .from(launches)
    .where(eq(launches.isUpcoming, true))
    .orderBy(asc(launches.net))
    .limit(limit);
}

/** Upcoming launches whose NET falls within the next `days` days. Shared by
 * the dashboard's "Upcoming · 30d" stat and the schedule page's header. */
export async function getUpcomingCount(days: number) {
  const [row] = await db
    .select({ value: count() })
    .from(launches)
    .where(
      and(
        eq(launches.isUpcoming, true),
        gte(launches.net, sql`now()`),
        lte(launches.net, sql`now() + interval '1 day' * ${days}`),
      ),
    );

  return row?.value ?? 0;
}

export async function getDashboardStats() {
  const [tracked, outcomes, upcomingIn30Days, agencyTotal] = await Promise.all([
    db.select({ value: count() }).from(launches),
    db
      .select({
        success: sql<string>`count(*) filter (where ${launches.status} = 'success')`,
        terminal: sql<string>`count(*) filter (where ${launches.status} in ('success', 'failure'))`,
      })
      .from(launches),
    getUpcomingCount(30),
    db.select({ value: count() }).from(agencies),
  ]);

  const success = Number(outcomes[0]?.success ?? 0);
  const terminal = Number(outcomes[0]?.terminal ?? 0);

  return {
    launchesTracked: tracked[0]?.value ?? 0,
    successRate: terminal > 0 ? (success / terminal) * 100 : null,
    upcomingIn30Days,
    agencyCount: agencyTotal[0]?.value ?? 0,
  };
}

/* ==================================================================
 * Launches (historical archive) reads  —  app/launches/page.tsx
 * ================================================================== */

export async function getLaunchesSummary() {
  const [totalRows, agencyRows] = await Promise.all([
    db.select({ value: count() }).from(launches),
    db.select({ value: count() }).from(agencies),
  ]);

  return {
    totalLaunches: totalRows[0]?.value ?? 0,
    agencyCount: agencyRows[0]?.value ?? 0,
  };
}

/** Top agencies by launch involvement (any stakeholder, not just operator)
 * — backs the quick-filter chip row. Returns `id` (for filtering) and
 * `name` (for the chip label) rather than the combined `providerName`
 * display string, since grouping by that would fragment into one noisy
 * bucket per unique multi-agency combination instead of clean per-agency
 * counts. */
export async function getTopProviders(limit = 3) {
  return db
    .select({ id: agencies.id, name: agencies.name, value: count() })
    .from(launchAgencies)
    .innerJoin(agencies, eq(agencies.id, launchAgencies.agencyId))
    .groupBy(agencies.id, agencies.name)
    .orderBy(desc(count()))
    .limit(limit);
}

export interface LaunchesQuery {
  search?: string;
  /** An agency id (e.g. "spacex"), not a display name — matches any
   * launch where that agency is a stakeholder, via `launch_agencies`. */
  provider?: string;
  outcome?: "success" | "failure";
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

export async function getLaunchesPage(params: LaunchesQuery = {}) {
  const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.trunc(params.pageSize ?? 20) || 20));
  const offset = (page - 1) * pageSize;

  // The historical archive is, by definition, launches that are no longer
  // upcoming — see the `isUpcoming` comment in schema.ts.
  const conditions = [eq(launches.isUpcoming, false)];
  if (params.provider) {
    const providerId = params.provider;
    conditions.push(
      sql`exists (select 1 from ${launchAgencies} where ${launchAgencies.launchId} = ${launches.id} and ${launchAgencies.agencyId} = ${providerId})`,
    );
  }
  if (params.outcome) conditions.push(eq(launches.status, params.outcome));
  if (params.search?.trim()) {
    conditions.push(
      sql`to_tsvector('english', coalesce(${launches.searchText}, '')) @@ plainto_tsquery('english', ${params.search.trim()})`,
    );
  }
  const where = and(...conditions);
  const orderBy = params.sort === "oldest" ? asc(launches.net) : desc(launches.net);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: launches.id,
        slug: launches.slug,
        name: launches.name,
        providerName: launches.providerName,
        rocket: launches.rocket,
        net: launches.net,
        netPrecision: launches.netPrecision,
        status: launches.status,
      })
      .from(launches)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(launches).where(where),
  ]);

  return {
    launches: rows,
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize,
  };
}

export type LaunchesPageResult = Awaited<ReturnType<typeof getLaunchesPage>>;
export type LaunchRow = LaunchesPageResult["launches"][number];

/* ==================================================================
 * Schedule reads  —  app/schedule/page.tsx
 * ================================================================== */

/** Every upcoming launch, ordered by NET (nulls last). Unlike /launches
 * there's no pagination — the full schedule is small and mostly static,
 * revalidated on the ingestion cadence rather than queried per filter. */
export async function getScheduleLaunches() {
  return db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      providerName: launches.providerName,
      net: launches.net,
      netPrecision: launches.netPrecision,
      status: launches.status,
      padLocation: launches.padLocation,
    })
    .from(launches)
    .where(eq(launches.isUpcoming, true))
    .orderBy(asc(launches.net));
}

export type ScheduleLaunchRow = Awaited<ReturnType<typeof getScheduleLaunches>>[number];

/** Upcoming launches within one calendar month (UTC), for the schedule
 * calendar view. `month` is 0-indexed (matches `Date#getUTCMonth`). */
export async function getScheduleLaunchesForMonth(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  return db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      providerName: launches.providerName,
      net: launches.net,
      netPrecision: launches.netPrecision,
      status: launches.status,
      padLocation: launches.padLocation,
    })
    .from(launches)
    .where(and(eq(launches.isUpcoming, true), gte(launches.net, start), lt(launches.net, end)))
    .orderBy(asc(launches.net));
}

/* ==================================================================
 * Agencies reads  —  app/agencies/page.tsx, app/agencies/[slug]/page.tsx
 * ================================================================== */

/** All agencies with their launch count (any stakeholder, not just
 * operator — via `launch_agencies`), most-launches first. `agencies.id`
 * is the primary key, so Postgres allows grouping by it alone even though
 * name/abbrev/type/country_code aren't aggregated (functional dependency). */
export async function getAgenciesList() {
  return db
    .select({
      id: agencies.id,
      name: agencies.name,
      abbrev: agencies.abbrev,
      type: agencies.type,
      countryCode: agencies.countryCode,
      launchCount: count(launchAgencies.launchId),
    })
    .from(agencies)
    .leftJoin(launchAgencies, eq(launchAgencies.agencyId, agencies.id))
    .groupBy(agencies.id)
    .orderBy(desc(count(launchAgencies.launchId)));
}

export async function getAgencyBySlug(slug: string) {
  const [row] = await db.select().from(agencies).where(eq(agencies.id, slug)).limit(1);
  return row ?? null;
}

/** Stats for every launch where this agency is a stakeholder — e.g. NASA's
 * count includes Crew missions it didn't operate, per `launch_agencies`. */
export async function getAgencyStats(agencyId: string) {
  const [totalRows, outcomeRows] = await Promise.all([
    db.select({ value: count() }).from(launchAgencies).where(eq(launchAgencies.agencyId, agencyId)),
    db
      .select({
        success: sql<string>`count(*) filter (where ${launches.status} = 'success')`,
        terminal: sql<string>`count(*) filter (where ${launches.status} in ('success', 'failure'))`,
      })
      .from(launchAgencies)
      .innerJoin(launches, eq(launches.id, launchAgencies.launchId))
      .where(eq(launchAgencies.agencyId, agencyId)),
  ]);

  const success = Number(outcomeRows[0]?.success ?? 0);
  const terminal = Number(outcomeRows[0]?.terminal ?? 0);

  return {
    totalLaunches: totalRows[0]?.value ?? 0,
    successRate: terminal > 0 ? (success / terminal) * 100 : null,
  };
}

/** Paginated launches where this agency is a stakeholder (operator or
 * otherwise — via `launch_agencies`), upcoming and past mixed together,
 * newest-NET first — plain pagination rather than the full search/filter
 * treatment `/launches` gets, since there's nothing to filter *by* on a
 * page that's already scoped to one agency. */
export async function getAgencyLaunchesPage(agencyId: string, page = 1, pageSize = 20) {
  const clampedPage = Math.max(1, Math.trunc(page) || 1);
  const clampedPageSize = Math.min(50, Math.max(1, Math.trunc(pageSize) || 20));
  const offset = (clampedPage - 1) * clampedPageSize;

  const where = eq(launchAgencies.agencyId, agencyId);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: launches.id,
        slug: launches.slug,
        name: launches.name,
        net: launches.net,
        netPrecision: launches.netPrecision,
        status: launches.status,
      })
      .from(launchAgencies)
      .innerJoin(launches, eq(launches.id, launchAgencies.launchId))
      .where(where)
      .orderBy(desc(launches.net))
      .limit(clampedPageSize)
      .offset(offset),
    db.select({ value: count() }).from(launchAgencies).where(where),
  ]);

  return {
    launches: rows,
    total: totalRows[0]?.value ?? 0,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/* ==================================================================
 * Enrichment passes (SpaceX, NASA)  —  app/api/cron/enrich-spacex,
 * app/api/cron/enrich-nasa
 * ------------------------------------------------------------------
 * Both write into the same `enrichment` JSONB column under their own
 * namespaced keys, so `mergeLaunchEnrichment` does an atomic jsonb merge
 * rather than a blind overwrite — otherwise whichever pass runs second
 * would silently wipe out the other's data. Uses `jsonb_exists(...)`
 * rather than the `?` jsonb operator directly, since `?` collides with
 * bind-parameter placeholders in some Postgres drivers/proxies.
 * ================================================================== */

export async function mergeLaunchEnrichment(id: string, partial: Record<string, unknown>) {
  await db
    .update(launches)
    .set({
      enrichment: sql`coalesce(${launches.enrichment}, '{}'::jsonb) || ${JSON.stringify(partial)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(eq(launches.id, id));
}

/** Launches with a SpaceX API cross-reference we haven't enriched yet.
 * Currently this is every launch with `spacexApiId` set, since that field
 * is null in all real LL2 data observed so far — see schema.ts. Checks
 * for the `cores` key specifically (not "any enrichment"), since NASA
 * enrichment writes to the same column under a different key. */
export async function getLaunchesNeedingSpacexEnrichment(limit = 20) {
  return db
    .select({ id: launches.id, spacexApiId: launches.spacexApiId })
    .from(launches)
    .where(
      and(
        isNotNull(launches.spacexApiId),
        sql`not jsonb_exists(coalesce(${launches.enrichment}, '{}'::jsonb), 'cores')`,
      ),
    )
    .limit(limit);
}

/** Launches never checked for NASA imagery — regardless of outcome. A
 * miss is recorded via `nasaImageCheckedAt` (see
 * normalize.ts#normalizeNasaEnrichment) precisely so this doesn't
 * re-attempt the same non-NASA-affiliated launch forever. */
export async function getLaunchesNeedingNasaImageCheck(limit = 50) {
  return db
    .select({ id: launches.id, name: launches.name })
    .from(launches)
    .where(sql`not jsonb_exists(coalesce(${launches.enrichment}, '{}'::jsonb), 'nasaImageCheckedAt')`)
    .limit(limit);
}

/* ==================================================================
 * Launch detail  —  app/launches/[slug]/page.tsx
 * ------------------------------------------------------------------
 * Routed by `slug`, not the internal `id` — the id is
 * "<source>:<externalId>" (e.g. "ll2:a1b2c3"), and a colon in a dynamic
 * route segment 404s in this Next.js/Turbopack setup regardless of
 * percent-encoding (reproduced with a minimal "a:b" test case before
 * concluding this, not assumed). `slug` was already unique and
 * colon-free, so routing by it sidesteps the issue entirely rather than
 * working around it.
 * ================================================================== */

export async function getLaunchBySlug(slug: string) {
  const [row] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  return row ?? null;
}

/** Other launches from the same agency, most recent first, excluding
 * the current one — the "More from <Provider>" sidebar list. */
export async function getMoreLaunchesFromAgency(agencyId: string, excludeId: string, limit = 5) {
  return db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      net: launches.net,
      netPrecision: launches.netPrecision,
    })
    .from(launchAgencies)
    .innerJoin(launches, eq(launches.id, launchAgencies.launchId))
    .where(and(eq(launchAgencies.agencyId, agencyId), ne(launches.id, excludeId)))
    .orderBy(desc(launches.net))
    .limit(limit);
}