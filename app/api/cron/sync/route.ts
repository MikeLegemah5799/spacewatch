/* ==================================================================
 * app/api/cron/sync/route.ts  —  schedule sync (upcoming window)
 * ------------------------------------------------------------------
 * Runs daily (see vercel.json) — originally designed for a ~15-minute
 * cadence per ARCHITECTURE.md §3, but Vercel Hobby caps cron jobs at
 * once a day (a sub-daily schedule fails deployment outright on that
 * plan). Upgrade to Pro and tighten this schedule for real freshness;
 * see progress-tracker.md. Fetches LL2's upcoming-launch list, normalizes
 * it, and upserts. Also flips any
 * previously-upcoming row that has quietly dropped off that list (its
 * NET passed) to `isUpcoming: false` — see
 * lib/db/queries.ts#markMissedLaunchesAsHistorical. The daily, paginated,
 * resumable historical backfill (ARCHITECTURE.md §3) is a separate unit.
 *
 * The only route allowed to call a third-party launch API — see
 * code-standards.md.
 * ================================================================== */

import { eq, sql } from "drizzle-orm";
import { db, syncRuns } from "@/lib/db";
import {
  markMissedLaunchesAsHistorical,
  upsertAgencies,
  upsertLaunchAgencyLinks,
  upsertLaunches,
} from "@/lib/db/queries";
import { normalizeLaunch, normalizeLaunchAgencyLinks, normalizeStakeholderAgencies } from "@/lib/normalize";
import { fetchUpcomingLaunches } from "@/lib/providers/ll2";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "schedule", source: "ll2" })
    .returning({ id: syncRuns.id });

  try {
    const rawLaunches = await fetchUpcomingLaunches(50);

    const agencyRows = rawLaunches.flatMap(normalizeStakeholderAgencies);
    const launchRows = rawLaunches.map((launch) => normalizeLaunch(launch, true));
    const agencyLinkRows = rawLaunches.flatMap(normalizeLaunchAgencyLinks);

    await upsertAgencies(agencyRows);
    const upserted = await upsertLaunches(launchRows);
    await upsertLaunchAgencyLinks(agencyLinkRows);
    const markedHistorical = await markMissedLaunchesAsHistorical(launchRows.map((launch) => launch.id));

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, recordsUpserted: upserted, ok: true })
      .where(eq(syncRuns.id, run.id));

    return Response.json({ ok: true, upserted, markedHistorical });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(syncRuns)
      .set({ finishedAt: sql`now()`, ok: false, error: message })
      .where(eq(syncRuns.id, run.id));

    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
