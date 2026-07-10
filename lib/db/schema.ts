import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------ */

/**
 * Where a row originated. Every launch carries this so a future provider
 * swap is a normalizer change, not a schema change. (See ARCHITECTURE §3.)
 */
export const sourceEnum = pgEnum("source", ["ll2", "spacex", "nasa"]);

/**
 * Unified status across providers. LL2's numeric status ids and SpaceX's
 * `success: boolean | null` both collapse into this in lib/normalize.ts.
 */
export const launchStatusEnum = pgEnum("launch_status", [
  "go",
  "tbd",
  "hold",
  "in_flight",
  "success",
  "failure",
]);

/** How precisely we know the launch time. Drives UI ("Jul 09" vs "Q3"). */
export const netPrecisionEnum = pgEnum("net_precision", [
  "second",
  "hour",
  "day",
  "month",
  "quarter",
  "year",
]);

/* ------------------------------------------------------------------
 * Agencies  —  backs /agencies/[slug]
 * ------------------------------------------------------------------ */

export const agencies = pgTable(
  "agencies",
  {
    id: text("id").primaryKey(), // slug: "spacex", "nasa"
    name: text("name").notNull(), // "SpaceX"
    abbrev: text("abbrev"), // "SpX"
    type: text("type"), // "Commercial" | "Government"
    countryCode: text("country_code"), // "USA"
    logoUrl: text("logo_url"),
    description: text("description"),
    externalId: text("external_id"), // LL2 agency id
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("agencies_external_id_idx").on(t.externalId)],
);

/* ------------------------------------------------------------------
 * Launches  —  system of record
 * ------------------------------------------------------------------ */

export const launches = pgTable(
  "launches",
  {
    /** Internal stable id: `${source}:${externalId}`, e.g. "ll2:a1b2c3". */
    id: text("id").primaryKey(),

    source: sourceEnum("source").notNull(),
    /** Provider's own id. Unique per source — the upsert conflict target. */
    externalId: text("external_id").notNull(),

    name: text("name").notNull(), // "Falcon 9 Block 5 | Starlink Group 12-7"
    slug: text("slug").notNull(), // "starlink-group-12-7"

    agencyId: text("agency_id").references(() => agencies.id, {
      onDelete: "set null",
    }),
    /** Denormalized for list rendering without a join. */
    providerName: text("provider_name").notNull(), // "SpaceX"
    rocket: text("rocket").notNull(), // "Falcon 9"

    /** No Earlier Than. Nullable: some far-future missions have no date. */
    net: timestamp("net", { withTimezone: true }),
    netPrecision: netPrecisionEnum("net_precision").notNull().default("second"),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),

    status: launchStatusEnum("status").notNull(),
    /** True once NET is in the past and status is terminal. */
    isUpcoming: boolean("is_upcoming").notNull().default(true),

    padName: text("pad_name"),
    padLocation: text("pad_location"), // "Cape Canaveral, FL"
    padLatitude: text("pad_latitude"), // text: avoids float drift, map-ready
    padLongitude: text("pad_longitude"),

    imageUrl: text("image_url"),
    webcastUrl: text("webcast_url"),
    missionDescription: text("mission_description"),
    missionType: text("mission_type"), // "Communications", "Test Flight", ... (LL2 `mission.type`)
    orbit: text("orbit"), // "LEO", "GTO"

    /**
     * Cross-reference to the archived SpaceX API v4's launch id — LL2's
     * `r_spacex_api_id`, when present. In practice this is currently null
     * on every launch we've observed (including missions confirmed to
     * exist in the SpaceX API's own docs), so the enrichment pass this
     * feeds is effectively dead code until/unless LL2 repopulates it. Kept
     * as designed rather than removed — see progress-tracker.md.
     */
    spacexApiId: text("spacex_api_id"),

    /**
     * Best-effort enrichment from the archived SpaceX API (cores, booster
     * reuse, landing outcome). Schemaless because it fails soft and its
     * shape is frozen — see ARCHITECTURE §3 consequences.
     */
    enrichment: jsonb("enrichment").$type<Record<string, unknown>>(),

    /** Full-text search vector over name + mission description. */
    searchText: text("search_text"),

    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Upsert conflict target for ingestion.
    uniqueIndex("launches_source_external_idx").on(t.source, t.externalId),
    uniqueIndex("launches_slug_idx").on(t.slug),

    // Schedule page: upcoming launches ordered by NET.
    index("launches_upcoming_net_idx").on(t.isUpcoming, t.net),
    // Historical browse: newest first.
    index("launches_net_desc_idx").on(sql`${t.net} DESC NULLS LAST`),
    // Filters.
    index("launches_agency_net_idx").on(t.agencyId, t.net),
    index("launches_status_idx").on(t.status),
    // SpaceX enrichment pass: find rows with a cross-reference not yet enriched.
    index("launches_spacex_api_id_idx").on(t.spacexApiId),

    // Search.
    index("launches_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.searchText}, ''))`,
    ),
  ],
);

/* ------------------------------------------------------------------
 * Sync runs  —  makes the daily backfill resumable
 * ------------------------------------------------------------------ */

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    /** "schedule" (~15 min) or "backfill" (daily, paginated). */
    kind: text("kind").notNull(),
    source: sourceEnum("source").notNull(),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Cursor to resume from if a rate limit stalls the run. */
    cursor: text("cursor"),
    recordsUpserted: integer("records_upserted").notNull().default(0),
    ok: boolean("ok").notNull().default(false),
    error: text("error"),
  },
  (t) => [index("sync_runs_kind_started_idx").on(t.kind, t.startedAt)],
);

/* ------------------------------------------------------------------
 * Watchlist  —  optional, gated behind Auth.js
 * ------------------------------------------------------------------ */

export const watchlist = pgTable(
  "watchlist",
  {
    userId: text("user_id").notNull(),
    launchId: text("launch_id")
      .notNull()
      .references(() => launches.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.launchId] }),
    index("watchlist_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------
 * Relations
 * ------------------------------------------------------------------ */

export const agenciesRelations = relations(agencies, ({ many }) => ({
  launches: many(launches),
}));

export const launchesRelations = relations(launches, ({ one, many }) => ({
  agency: one(agencies, {
    fields: [launches.agencyId],
    references: [agencies.id],
  }),
  watchers: many(watchlist),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  launch: one(launches, {
    fields: [watchlist.launchId],
    references: [launches.id],
  }),
}));

/* ------------------------------------------------------------------
 * Inferred types  —  `Launch` here replaces the hand-written interface
 * ------------------------------------------------------------------ */

export type Launch = typeof launches.$inferSelect;
export type NewLaunch = typeof launches.$inferInsert;
export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
