/* ==================================================================
 * app/api/cron/enrich-spacex/route.ts  —  SpaceX enrichment pass
 * ------------------------------------------------------------------
 * A separate, fail-soft pass (ARCHITECTURE.md §3) — distinct from the
 * schedule-sync and backfill crons. Writes `launches.enrichment` under
 * the `cores` key; app/api/cron/enrich-nasa writes the same column
 * under a different key, via the same merge helper so neither clobbers
 * the other. Per-launch failures (including "the archived API is
 * unreachable," which is the current reality — see
 * lib/providers/spacex.ts) are expected and never fail the run: this
 * route's `ok` reflects whether the pass *ran*, not whether every
 * launch got enriched.
 * ================================================================== */

import { eq, sql } from "drizzle-orm";
import { db, syncRuns } from "@/lib/db";
import { getLaunchesNeedingSpacexEnrichment, mergeLaunchEnrichment } from "@/lib/db/queries";
import { normalizeSpacexEnrichment } from "@/lib/normalize";
import { fetchSpacexLaunch } from "@/lib/providers/spacex";

const BATCH_SIZE = 20;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "enrich", source: "spacex" })
    .returning({ id: syncRuns.id });

  const candidates = await getLaunchesNeedingSpacexEnrichment(BATCH_SIZE);

  let enriched = 0;
  for (const launch of candidates) {
    // Never null in practice (the query filters on it), but keep the
    // fetch call's argument type honest.
    if (!launch.spacexApiId) continue;

    const spacexLaunch = await fetchSpacexLaunch(launch.spacexApiId);
    if (!spacexLaunch) continue; // fail soft: log-worthy, not run-fatal

    await mergeLaunchEnrichment(launch.id, normalizeSpacexEnrichment(spacexLaunch));
    enriched++;
  }

  const summary =
    candidates.length === 0
      ? "No launches with an unenriched SpaceX cross-reference"
      : `${enriched}/${candidates.length} enriched`;

  await db
    .update(syncRuns)
    .set({ finishedAt: sql`now()`, recordsUpserted: enriched, ok: true, error: summary })
    .where(eq(syncRuns.id, run.id));

  return Response.json({ ok: true, attempted: candidates.length, enriched, summary });
}
