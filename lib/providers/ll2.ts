/* ==================================================================
 * lib/providers/ll2.ts  —  Launch Library 2 client
 * ------------------------------------------------------------------
 * The sole source of truth for the schedule (see ARCHITECTURE.md §3).
 * This is the only provider client allowed to fail an ingestion run —
 * spacex.ts and nasa.ts must fail soft instead.
 *
 * Free tier is ~15 req/hour anonymous; set LL2_API_KEY to raise it.
 * LL2_API_BASE_URL is only meant for pointing at a non-production
 * mirror during local development, so as to not burn the shared quota.
 * ================================================================== */

const LL2_BASE_URL = process.env.LL2_API_BASE_URL ?? "https://ll.thespacedevs.com/2.2.0";

export interface LL2Status {
  id: number;
  name: string;
  abbrev: string;
}

export interface LL2NetPrecision {
  id: number;
  name: string;
  abbrev: string;
}

export interface LL2Agency {
  id: number;
  name: string;
  abbrev: string | null;
  type: string | null;
  country_code: string | null;
}

export interface LL2Orbit {
  id: number;
  name: string;
  abbrev: string;
}

export interface LL2Mission {
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  orbit: LL2Orbit | null;
}

export interface LL2RocketConfiguration {
  id: number;
  name: string;
  full_name: string;
}

export interface LL2Rocket {
  id: number;
  configuration: LL2RocketConfiguration;
}

export interface LL2PadLocation {
  id: number;
  name: string;
  country_code: string | null;
}

export interface LL2Pad {
  id: number;
  name: string;
  location: LL2PadLocation | null;
  latitude: string | null;
  longitude: string | null;
}

export interface LL2VidURL {
  url: string;
}

export interface LL2Launch {
  id: string;
  name: string;
  status: LL2Status;
  net: string | null;
  net_precision: LL2NetPrecision | null;
  window_start: string | null;
  window_end: string | null;
  launch_service_provider: LL2Agency;
  rocket: LL2Rocket;
  mission: LL2Mission | null;
  pad: LL2Pad | null;
  image: string | null;
  vidURLs: LL2VidURL[];
  /** Cross-reference to the archived SpaceX API v4's launch id, when LL2
   * has one on file. In current real data this is null even for launches
   * confirmed to exist in the SpaceX API's own docs — see
   * lib/providers/spacex.ts and progress-tracker.md. */
  r_spacex_api_id: string | null;
}

interface LL2ListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

/** Narrow, hand-rolled validation of the fields normalize.ts actually
 * consumes — enough to fail loudly on a shape change upstream without
 * pulling in a schema-validation dependency for one provider client. */
function assertLaunchShape(raw: unknown, index: number): asserts raw is LL2Launch {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`LL2 launch[${index}] is not an object`);
  }

  const r = raw as Record<string, unknown>;

  if (typeof r.id !== "string" || typeof r.name !== "string") {
    throw new Error(`LL2 launch[${index}] is missing id/name`);
  }
  if (typeof r.status !== "object" || r.status === null || typeof (r.status as { id?: unknown }).id !== "number") {
    throw new Error(`LL2 launch[${index}] (${r.id}) is missing status.id`);
  }
  const lsp = r.launch_service_provider as { id?: unknown; name?: unknown } | undefined;
  if (!lsp || typeof lsp.id !== "number" || typeof lsp.name !== "string") {
    throw new Error(`LL2 launch[${index}] (${r.id}) is missing launch_service_provider.id/name`);
  }
  const rocket = r.rocket as { configuration?: { name?: unknown } } | undefined;
  if (!rocket?.configuration || typeof rocket.configuration.name !== "string") {
    throw new Error(`LL2 launch[${index}] (${r.id}) is missing rocket.configuration.name`);
  }
}

function authHeaders(): HeadersInit {
  return process.env.LL2_API_KEY ? { Authorization: `Token ${process.env.LL2_API_KEY}` } : {};
}

/** Thrown specifically on HTTP 429. The backfill cron treats this as an
 * expected pause-and-resume-later point, not a hard failure — see
 * ARCHITECTURE.md §3 ("so a rate-limit stall can pick back up where it
 * stopped"). The schedule-sync cron just lets it propagate as a normal
 * failed run, since it only ever needs one page. */
export class LL2RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LL2RateLimitError";
  }
}

async function fetchLaunchList(url: string | URL): Promise<LL2ListResponse<LL2Launch>> {
  const res = await fetch(url, { headers: authHeaders() });

  if (res.status === 429) {
    throw new LL2RateLimitError(`LL2 rate limit hit (429) fetching ${url}`);
  }
  if (!res.ok) {
    throw new Error(`LL2 request failed: ${res.status} ${res.statusText} (${url})`);
  }

  const body = (await res.json()) as LL2ListResponse<unknown>;
  body.results.forEach(assertLaunchShape);
  return body as LL2ListResponse<LL2Launch>;
}

/** The upcoming-launch schedule — feeds the ~15-minute schedule-sync cron. */
export async function fetchUpcomingLaunches(limit = 50): Promise<LL2Launch[]> {
  const url = new URL(`${LL2_BASE_URL}/launch/upcoming/`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("mode", "detailed");

  const body = await fetchLaunchList(url);
  return body.results;
}

const PREVIOUS_LAUNCHES_FIRST_PAGE = `${LL2_BASE_URL}/launch/previous/?limit=50&mode=detailed`;

/** One page of the historical archive, ordered newest-first by LL2. Pass
 * the `next` URL from a prior call to page forward — LL2's `next` link
 * already encodes offset/limit/mode, so it doubles as the resumable
 * cursor stored in `sync_runs.cursor`. Omit it to start from page one. */
export async function fetchPreviousLaunches(
  pageUrl: string = PREVIOUS_LAUNCHES_FIRST_PAGE,
): Promise<{ launches: LL2Launch[]; next: string | null }> {
  const body = await fetchLaunchList(pageUrl);
  return { launches: body.results, next: body.next };
}
