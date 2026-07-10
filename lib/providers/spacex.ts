/* ==================================================================
 * lib/providers/spacex.ts  —  SpaceX API v4 client (archived, best-effort)
 * ------------------------------------------------------------------
 * Supplementary enrichment only — cores, booster reuse, landing outcomes
 * for SpaceX launches where LL2 lacks the field (ARCHITECTURE.md §3).
 * Unlike lib/providers/ll2.ts, this client must never block an
 * ingestion run: every function here fails soft, returning `null`
 * instead of throwing, so a caller never needs its own try/catch.
 *
 * As of this writing the archived API returns a Cloudflare 525 (origin
 * unreachable) on every endpoint — not just stale data, the origin
 * server itself appears to be gone. This client is written as if it
 * might work, exactly per ARCHITECTURE.md §3 ("If the archived SpaceX
 * endpoints eventually go dark, the app degrades to LL2-only detail and
 * keeps working — no migration required"): correct now, inert today.
 * ================================================================== */

const SPACEX_BASE_URL = process.env.SPACEX_API_BASE_URL ?? "https://api.spacexdata.com/v4";

export interface SpaceXCore {
  flight: number | null;
  reused: boolean | null;
  gridfins: boolean | null;
  legs: boolean | null;
  landing_attempt: boolean | null;
  landing_success: boolean | null;
  landing_type: string | null;
}

export interface SpaceXLaunch {
  id: string;
  success: boolean | null;
  cores: SpaceXCore[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCore(raw: unknown): SpaceXCore | null {
  if (!isRecord(raw)) return null;

  return {
    flight: typeof raw.flight === "number" ? raw.flight : null,
    reused: typeof raw.reused === "boolean" ? raw.reused : null,
    gridfins: typeof raw.gridfins === "boolean" ? raw.gridfins : null,
    legs: typeof raw.legs === "boolean" ? raw.legs : null,
    landing_attempt: typeof raw.landing_attempt === "boolean" ? raw.landing_attempt : null,
    landing_success: typeof raw.landing_success === "boolean" ? raw.landing_success : null,
    landing_type: typeof raw.landing_type === "string" ? raw.landing_type : null,
  };
}

/**
 * Fetches one launch by its SpaceX API v4 id. Returns `null` — not a
 * thrown error — on any failure: network error, non-200, or a response
 * that doesn't have the shape this pass needs.
 */
export async function fetchSpacexLaunch(spacexApiId: string): Promise<SpaceXLaunch | null> {
  try {
    const res = await fetch(`${SPACEX_BASE_URL}/launches/${spacexApiId}`);
    if (!res.ok) return null;

    const body: unknown = await res.json();
    if (!isRecord(body) || typeof body.id !== "string" || !Array.isArray(body.cores)) {
      return null;
    }

    return {
      id: body.id,
      success: typeof body.success === "boolean" ? body.success : null,
      cores: body.cores.map(parseCore).filter((core): core is SpaceXCore => core !== null),
    };
  } catch {
    return null;
  }
}
