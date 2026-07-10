/* ==================================================================
 * app/api/cron/backfill/route.ts  —  historical backfill
 * ------------------------------------------------------------------
 * Runs daily (see vercel.json), in one of two modes depending on
 * whether the historical archive has been fully drained yet:
 *
 * - "drain" (no completed run on record): paginate LL2's
 *   `/launch/previous/` list, resumable — each invocation picks up from
 *   the last saved cursor and walks forward until either the archive is
 *   fully drained, the per-invocation page cap is hit, or LL2
 *   rate-limits us (429). All three save the resume cursor and stop,
 *   rather than erroring out.
 * - "catch-up" (a prior run already drained everything): LL2 orders
 *   `/previous/` newest-first, so re-walking the whole archive daily
 *   would be wasteful. Instead, check just the first couple of pages —
 *   enough to catch anything that's completed since the last check, and
 *   to correct `isUpcoming`/`status` for any launch that transitioned
 *   from upcoming to historical in the meantime (schedule-sync flips
 *   `isUpcoming` on its own cadence, but doesn't know the real outcome —
 *   see app/api/cron/sync/route.ts).
 *
 * Separate cadence/boundary from the ~15-min schedule-sync cron
 * (ARCHITECTURE.md §3) — this only ever writes `isUpcoming: false` rows.
 *
 * The only other route allowed to call a third-party launch API — see
 * code-standards.md.
 * ================================================================== */

import { and, desc, eq, sql } from "drizzle-orm";
import { db, syncRuns } from "@/lib/db";
import { upsertAgencies, upsertLaunches } from "@/lib/db/queries";
import { normalizeAgency, normalizeLaunch } from "@/lib/normalize";
import { fetchPreviousLaunches, LL2RateLimitError } from "@/lib/providers/ll2";

export const maxDuration = 60;

// Anonymous LL2 access is ~15 req/hour; stop comfortably under that so one
// invocation can't itself exhaust the quota schedule-sync also depends on.
const MAX_PAGES_PER_DRAIN_RUN = 10;
// Steady-state maintenance needs far less: two pages (100 launches) is a
// generous buffer against a single cron invocation getting missed.
const CATCH_UP_PAGES = 2;

async function ingestPage(pageUrl?: string) {
  const { launches: rawLaunches, next } = await fetchPreviousLaunches(pageUrl);

  const agencyRows = rawLaunches.map((launch) => normalizeAgency(launch.launch_service_provider));
  const launchRows = rawLaunches.map((launch) => normalizeLaunch(launch, false));

  await upsertAgencies(agencyRows);
  const upserted = await upsertLaunches(launchRows);

  return { upserted, next };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [previousRun] = await db
    .select()
    .from(syncRuns)
    .where(and(eq(syncRuns.kind, "backfill"), eq(syncRuns.source, "ll2")))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  if (previousRun?.ok) {
    return runCatchUp();
  }

  return runDrain(previousRun?.cursor ?? undefined);
}

/** Steady-state mode, once the archive has been fully drained at least once. */
async function runCatchUp() {
  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "backfill", source: "ll2" })
    .returning({ id: syncRuns.id });

  try {
    let pageUrl: string | undefined;
    let totalUpserted = 0;

    for (let page = 0; page < CATCH_UP_PAGES; page++) {
      const { upserted, next } = await ingestPage(pageUrl);
      totalUpserted += upserted;
      if (!next) break;
      pageUrl = next;
    }

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, recordsUpserted: totalUpserted, ok: true, cursor: null })
      .where(eq(syncRuns.id, run.id));

    return Response.json({ ok: true, done: true, mode: "catch-up", upserted: totalUpserted });
  } catch (error) {
    const rateLimited = error instanceof LL2RateLimitError;
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, ok: false, error: message })
      .where(eq(syncRuns.id, run.id));

    return Response.json(
      { ok: rateLimited, done: false, mode: "catch-up", rateLimited, error: message },
      { status: rateLimited ? 200 : 502 },
    );
  }
}

/** First-time (or resumed) full drain of the historical archive. */
async function runDrain(startCursor: string | undefined) {
  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "backfill", source: "ll2", cursor: startCursor ?? null })
    .returning({ id: syncRuns.id });

  let pageUrl = startCursor;
  let totalUpserted = 0;
  let pagesFetched = 0;

  try {
    while (pagesFetched < MAX_PAGES_PER_DRAIN_RUN) {
      const { upserted, next } = await ingestPage(pageUrl);
      totalUpserted += upserted;
      pagesFetched++;

      if (!next) {
        await db
          .update(syncRuns)
          .set({ finishedAt: sql`now()`, recordsUpserted: totalUpserted, ok: true, cursor: null })
          .where(eq(syncRuns.id, run.id));

        return Response.json({ ok: true, done: true, mode: "drain", upserted: totalUpserted, pagesFetched });
      }

      pageUrl = next;
      // Persist progress after every page, not just at the end, so a
      // mid-run crash still resumes close to where it stopped.
      await db
        .update(syncRuns)
        .set({ cursor: next, recordsUpserted: totalUpserted })
        .where(eq(syncRuns.id, run.id));
    }

    await db
      .update(syncRuns)
      .set({
        finishedAt: sql`now()`,
        recordsUpserted: totalUpserted,
        ok: false,
        error: "Paused: per-invocation page cap reached",
      })
      .where(eq(syncRuns.id, run.id));

    return Response.json({
      ok: true,
      done: false,
      mode: "drain",
      upserted: totalUpserted,
      pagesFetched,
      cursor: pageUrl,
    });
  } catch (error) {
    const rateLimited = error instanceof LL2RateLimitError;
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, recordsUpserted: totalUpserted, ok: false, error: message })
      .where(eq(syncRuns.id, run.id));

    return Response.json(
      { ok: rateLimited, done: false, mode: "drain", rateLimited, upserted: totalUpserted, pagesFetched, error: message },
      { status: rateLimited ? 200 : 502 },
    );
  }
}
