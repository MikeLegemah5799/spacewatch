/* ==================================================================
 * app/api/cron/enrich-nasa/route.ts  —  NASA imagery enrichment pass
 * ------------------------------------------------------------------
 * A separate, fail-soft pass (ARCHITECTURE.md §3), searching every
 * not-yet-checked launch by mission name. Most launches (routine
 * commercial missions) legitimately have no NASA media coverage — that's
 * recorded as a checked-but-empty result (see
 * lib/normalize.ts#normalizeNasaEnrichment), not a failure, so this
 * route's `ok` reflects whether the pass *ran*, not whether every launch
 * found an image.
 * ================================================================== */

import { eq, sql } from "drizzle-orm";
import { db, syncRuns } from "@/lib/db";
import { getLaunchesNeedingNasaImageCheck, mergeLaunchEnrichment } from "@/lib/db/queries";
import { getMissionName } from "@/lib/format";
import { normalizeNasaEnrichment } from "@/lib/normalize";
import { searchNasaImage } from "@/lib/providers/nasa";

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "enrich", source: "nasa" })
    .returning({ id: syncRuns.id });

  const candidates = await getLaunchesNeedingNasaImageCheck(BATCH_SIZE);

  let found = 0;
  for (const launch of candidates) {
    const result = await searchNasaImage(getMissionName(launch.name));
    await mergeLaunchEnrichment(launch.id, normalizeNasaEnrichment(result));
    if (result) found++;
  }

  const summary =
    candidates.length === 0
      ? "No unchecked launches"
      : `${found}/${candidates.length} matched a NASA image`;

  await db
    .update(syncRuns)
    .set({ finishedAt: sql`now()`, recordsUpserted: found, ok: true, error: summary })
    .where(eq(syncRuns.id, run.id));

  return Response.json({ ok: true, checked: candidates.length, found, summary });
}
