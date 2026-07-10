/* ==================================================================
 * app/api/cron/backfill/route.ts  —  historical backfill
 * ------------------------------------------------------------------
 * Runs daily (see vercel.json). Drains LL2's `/launch/previous/` list,
 * paginated and resumable: each invocation picks up from the last saved
 * cursor and walks forward until either the archive is fully drained,
 * the per-invocation page cap is hit, or LL2 rate-limits us (429) — all
 * three save the resume cursor and stop, rather than erroring out.
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
const MAX_PAGES_PER_RUN = 10;

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
    // Full drain already completed by a prior run. Re-walking from page one
    // would just re-upsert everything (harmless, since upserts are
    // idempotent) for zero new rows — LL2 orders `/previous/` newest-first,
    // so newly-completed launches land at page one, not past our old
    // cursor. Catching those up periodically is a real, separate need
    // (see progress-tracker.md) that this route doesn't attempt yet.
    return Response.json({
      ok: true,
      done: true,
      message: "Historical backfill already complete for this source.",
    });
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "backfill", source: "ll2", cursor: previousRun?.cursor ?? null })
    .returning({ id: syncRuns.id });

  let pageUrl = previousRun?.cursor ?? undefined;
  let totalUpserted = 0;
  let pagesFetched = 0;

  try {
    while (pagesFetched < MAX_PAGES_PER_RUN) {
      const { launches: rawLaunches, next } = await fetchPreviousLaunches(pageUrl);
      pagesFetched++;

      const agencyRows = rawLaunches.map((launch) => normalizeAgency(launch.launch_service_provider));
      const launchRows = rawLaunches.map((launch) => normalizeLaunch(launch, false));

      await upsertAgencies(agencyRows);
      totalUpserted += await upsertLaunches(launchRows);

      if (!next) {
        await db
          .update(syncRuns)
          .set({ finishedAt: sql`now()`, recordsUpserted: totalUpserted, ok: true, cursor: null })
          .where(eq(syncRuns.id, run.id));

        return Response.json({ ok: true, done: true, upserted: totalUpserted, pagesFetched });
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

    return Response.json({ ok: true, done: false, upserted: totalUpserted, pagesFetched, cursor: pageUrl });
  } catch (error) {
    const rateLimited = error instanceof LL2RateLimitError;
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, recordsUpserted: totalUpserted, ok: false, error: message })
      .where(eq(syncRuns.id, run.id));

    return Response.json(
      { ok: rateLimited, done: false, rateLimited, upserted: totalUpserted, pagesFetched, error: message },
      { status: rateLimited ? 200 : 502 },
    );
  }
}
