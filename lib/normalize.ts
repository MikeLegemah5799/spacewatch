/* ==================================================================
 * lib/normalize.ts  —  the only place provider payloads get mapped
 * into the unified schema (see ARCHITECTURE.md §6, code-standards.md).
 * ================================================================== */

import type { Launch, NewAgency, NewLaunch, NewLaunchAgency } from "@/lib/db";
import type { LL2Agency, LL2Launch } from "@/lib/providers/ll2";
import type { NasaImageResult } from "@/lib/providers/nasa";
import type { SpaceXLaunch } from "@/lib/providers/spacex";

/**
 * LL2 status id -> our unified status. LL2 draws finer distinctions
 * ("Partial Failure", "To Be Confirmed") that don't have a dedicated bucket
 * here, so they collapse into the closest of our six states.
 */
const STATUS_MAP: Record<number, Launch["status"]> = {
  1: "go", // Go for Launch
  2: "tbd", // To Be Determined
  3: "success", // Launch Successful
  4: "failure", // Launch Failure
  5: "hold", // On Hold
  6: "in_flight", // Launch in Flight
  7: "failure", // Partial Failure — no distinct bucket; closest is failure
  8: "tbd", // To Be Confirmed — date not yet certain, same bucket as tbd
};

/**
 * LL2's net_precision is far more granular (17 values) than our 6-value
 * enum. Always round to the next COARSER bucket we have, never a finer
 * one, so displayed precision never overstates what's actually known.
 * "Decade" has no coarser bucket than "year" here, so that's the one case
 * that necessarily understates the real uncertainty.
 */
const NET_PRECISION_MAP: Record<number, Launch["netPrecision"]> = {
  0: "second", // Second
  1: "hour", // Minute
  2: "hour", // Hour
  3: "day", // Morning
  4: "day", // Afternoon
  5: "day", // Day
  6: "month", // Week
  7: "month", // Month
  8: "quarter", // Quarter 1
  9: "quarter", // Quarter 2
  10: "quarter", // Quarter 3
  11: "quarter", // Quarter 4
  12: "year", // Year Half 1
  13: "year", // Year Half 2
  14: "year", // Year
  15: "year", // Fiscal Year
  16: "year", // Decade
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Agency `name` ranges from "SpaceX" to "National Aeronautics and Space
 * Administration" — LL2 has no single field that's reliably short *and*
 * recognizable. Heuristic: once the full name gets unwieldy, prefer the
 * shorter `abbrev` (NASA, ULA, CASC, ...). Not a curated per-agency lookup,
 * so a handful of agencies (e.g. "RFSA" for Roscosmos) will look off.
 */
function displayAgencyName(name: string, abbrev: string | null): string {
  return name.length > 20 && abbrev ? abbrev : name;
}

export function normalizeAgency(raw: LL2Agency): NewAgency {
  return {
    id: slugify(raw.name),
    name: displayAgencyName(raw.name, raw.abbrev),
    abbrev: raw.abbrev,
    type: raw.type,
    countryCode: raw.country_code,
    externalId: String(raw.id),
  };
}

/**
 * Every agency relevant to a launch: the operator (`launch_service_provider`)
 * plus `mission.agencies` — a genuinely distinct set, not a superset (a Crew
 * mission's operator is SpaceX; `mission.agencies` lists NASA + international
 * ISS partners, and often doesn't include SpaceX at all). Deduplicated by
 * slug, operator first, since the two lists can overlap (many single-agency
 * launches just repeat the operator in `mission.agencies`, or list nothing).
 */
function getStakeholderAgencies(raw: LL2Launch): LL2Agency[] {
  const bySlug = new Map<string, LL2Agency>();
  bySlug.set(slugify(raw.launch_service_provider.name), raw.launch_service_provider);
  for (const agency of raw.mission?.agencies ?? []) {
    const key = slugify(agency.name);
    if (!bySlug.has(key)) bySlug.set(key, agency);
  }
  return [...bySlug.values()];
}

/**
 * `isUpcoming` is set by the caller rather than inferred from `raw.status`,
 * matching which LL2 endpoint the row came from: schedule-sync always
 * passes `true` (it only ever reads `/launch/upcoming/`), backfill always
 * passes `false` (it only ever reads `/launch/previous/`). LL2's own
 * "previous" list can include a launch whose status hasn't been updated to
 * a terminal outcome yet (net has passed but LL2 still shows e.g. "Go") —
 * trusting the source endpoint, not the status field, is what keeps
 * `isUpcoming` consistent with which cron actually saw the row.
 */
export function normalizeLaunch(raw: LL2Launch, isUpcoming: boolean): NewLaunch {
  const missionName = raw.mission?.name ?? raw.name;
  const orbitAbbrev =
    raw.mission?.orbit && raw.mission.orbit.abbrev !== "N/A" ? raw.mission.orbit.abbrev : null;

  return {
    id: `ll2:${raw.id}`,
    source: "ll2",
    externalId: raw.id,
    // LL2 already formats this as "<rocket full name> | <mission name>" —
    // see lib/format.ts#getMissionName, which is the only place it's split.
    name: raw.name,
    // Not currently used for routing (app/launches/[id] routes by internal
    // id), so a short id suffix for guaranteed uniqueness beats a "prettier"
    // slug that could collide (mission names like "Demo Flight" repeat).
    slug: `${slugify(missionName)}-${raw.id.slice(0, 8)}`,
    agencyId: slugify(raw.launch_service_provider.name),
    // All stakeholders joined ("SpaceX · NASA · JAXA · Roscosmos" for a
    // Crew mission), not just the operator — see getStakeholderAgencies.
    // `agencyId` above stays operator-only (rocket-specific queries);
    // this is purely the display string.
    providerName: getStakeholderAgencies(raw)
      .map((agency) => displayAgencyName(agency.name, agency.abbrev))
      .join(" · "),
    rocket: raw.rocket.configuration.name,
    spacexApiId: raw.r_spacex_api_id,
    net: raw.net ? new Date(raw.net) : null,
    netPrecision: raw.net_precision ? (NET_PRECISION_MAP[raw.net_precision.id] ?? "year") : "year",
    windowStart: raw.window_start ? new Date(raw.window_start) : null,
    windowEnd: raw.window_end ? new Date(raw.window_end) : null,
    status: STATUS_MAP[raw.status.id] ?? "tbd",
    isUpcoming,
    padName: raw.pad?.name ?? null,
    padLocation: raw.pad?.location?.name ?? null,
    padLatitude: raw.pad?.latitude ?? null,
    padLongitude: raw.pad?.longitude ?? null,
    imageUrl: raw.image,
    webcastUrl: raw.vidURLs[0]?.url ?? null,
    missionDescription: raw.mission?.description ?? null,
    missionType: raw.mission?.type ?? null,
    orbit: orbitAbbrev,
    searchText: [raw.name, raw.mission?.description].filter(Boolean).join(" "),
  };
}

/** Every stakeholder agency for a launch, normalized for upserting into
 * `agencies` — not just the operator, since `mission.agencies` can name
 * agencies `normalizeAgency(raw.launch_service_provider)` alone would
 * never see (international ISS partners on a Crew mission, for example). */
export function normalizeStakeholderAgencies(raw: LL2Launch): NewAgency[] {
  return getStakeholderAgencies(raw).map(normalizeAgency);
}

/** Join-table rows linking a launch to every one of its stakeholder
 * agencies — the source of truth for "which agencies does this launch
 * belong to," which `launches.agencyId` (operator-only) can't answer. */
export function normalizeLaunchAgencyLinks(raw: LL2Launch): NewLaunchAgency[] {
  const launchId = `ll2:${raw.id}`;
  return getStakeholderAgencies(raw).map((agency) => ({
    launchId,
    agencyId: slugify(agency.name),
  }));
}

/**
 * Maps a SpaceX API v4 launch into the `launches.enrichment` JSONB shape.
 * Deliberately narrow — just the fields ARCHITECTURE.md §3 calls out
 * (cores, booster reuse, landing outcomes) plus fairing reuse (free —
 * already in the payload this fetches, just not parsed before). Does
 * NOT include booster serial numbers or landing site names: those are
 * UUID references (`core`, `landpad`) needing additional per-launch API
 * calls against an API that's currently fully offline — not worth
 * chasing until/unless it comes back (see progress-tracker.md).
 */
export function normalizeSpacexEnrichment(raw: SpaceXLaunch): Record<string, unknown> {
  return {
    source: "spacex-api-v4",
    fetchedAt: new Date().toISOString(),
    success: raw.success,
    fairings: raw.fairings
      ? {
          reused: raw.fairings.reused,
          recoveryAttempt: raw.fairings.recovery_attempt,
          recovered: raw.fairings.recovered,
        }
      : null,
    cores: raw.cores.map((core) => ({
      flight: core.flight,
      reused: core.reused,
      gridfins: core.gridfins,
      legs: core.legs,
      landingAttempt: core.landing_attempt,
      landingSuccess: core.landing_success,
      landingType: core.landing_type,
    })),
  };
}

/**
 * Maps a NASA Image Library search result (or a miss) into the
 * `launches.enrichment` JSONB shape. Always sets `nasaImageCheckedAt` —
 * that's the marker `getLaunchesNeedingNasaImageCheck` looks for, so a
 * miss (the common case: most launches have no NASA coverage) doesn't
 * get re-attempted on every future run.
 */
export function normalizeNasaEnrichment(result: NasaImageResult | null): Record<string, unknown> {
  return {
    nasaImageCheckedAt: new Date().toISOString(),
    nasaImage: result
      ? { title: result.title, url: result.url, dateCreated: result.dateCreated }
      : null,
  };
}
