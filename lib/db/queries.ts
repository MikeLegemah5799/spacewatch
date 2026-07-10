/* ==================================================================
 * Ingestion upsert  —  the shape lib/providers + normalize feed into
 * ================================================================== */

import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import { agencies, db, launches, type NewAgency, type NewLaunch } from "@/lib/db";

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

/* ==================================================================
 * Dashboard reads  —  app/dashboard/page.tsx
 * ================================================================== */

export async function getNextLaunch() {
  const [row] = await db
    .select({
      id: launches.id,
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

/** Top providers by launch count — backs the quick-filter chip row. */
export async function getTopProviders(limit = 3) {
  return db
    .select({ providerName: launches.providerName, value: count() })
    .from(launches)
    .groupBy(launches.providerName)
    .orderBy(desc(count()))
    .limit(limit);
}

export interface LaunchesQuery {
  search?: string;
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
  if (params.provider) conditions.push(eq(launches.providerName, params.provider));
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

/** All agencies with their launch count, most-launches first. `agencies.id`
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
      launchCount: count(launches.id),
    })
    .from(agencies)
    .leftJoin(launches, eq(launches.agencyId, agencies.id))
    .groupBy(agencies.id)
    .orderBy(desc(count(launches.id)));
}

export async function getAgencyBySlug(slug: string) {
  const [row] = await db.select().from(agencies).where(eq(agencies.id, slug)).limit(1);
  return row ?? null;
}

export async function getAgencyStats(agencyId: string) {
  const [totalRows, outcomeRows] = await Promise.all([
    db.select({ value: count() }).from(launches).where(eq(launches.agencyId, agencyId)),
    db
      .select({
        success: sql<string>`count(*) filter (where ${launches.status} = 'success')`,
        terminal: sql<string>`count(*) filter (where ${launches.status} in ('success', 'failure'))`,
      })
      .from(launches)
      .where(eq(launches.agencyId, agencyId)),
  ]);

  const success = Number(outcomeRows[0]?.success ?? 0);
  const terminal = Number(outcomeRows[0]?.terminal ?? 0);

  return {
    totalLaunches: totalRows[0]?.value ?? 0,
    successRate: terminal > 0 ? (success / terminal) * 100 : null,
  };
}

/** Most recent launches for one agency, upcoming and past mixed together,
 * newest-NET first — a single reverse-chronological feed rather than the
 * full search/filter/paginate treatment `/launches` gets, since one
 * agency's launch count is small relative to the whole archive. */
export async function getAgencyLaunches(agencyId: string, limit = 20) {
  return db
    .select({
      id: launches.id,
      name: launches.name,
      net: launches.net,
      netPrecision: launches.netPrecision,
      status: launches.status,
    })
    .from(launches)
    .where(eq(launches.agencyId, agencyId))
    .orderBy(desc(launches.net))
    .limit(limit);
}