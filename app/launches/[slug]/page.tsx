import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconBookmark,
  IconCalendar,
  IconChevronRight,
  IconMapPin,
  IconPlayerPlay,
  IconRocket,
} from "@tabler/icons-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { getLaunchBySlug, getMoreLaunchesFromAgency } from "@/lib/db/queries";
import {
  formatFullDateTime,
  formatNet,
  formatSite,
  getMissionName,
  getOperatorName,
} from "@/lib/format";

interface CoreFact {
  flight: number | null;
  reused: boolean | null;
  landingAttempt: boolean | null;
  landingSuccess: boolean | null;
  landingType: string | null;
}

interface FairingsFact {
  reused: boolean | null;
}

/** `enrichment` is schemaless JSONB (see schema.ts) — these narrow it
 * defensively rather than trusting its shape. */
function getCores(enrichment: Record<string, unknown> | null): CoreFact[] {
  if (!enrichment || !Array.isArray(enrichment.cores)) return [];
  return enrichment.cores.filter(
    (core): core is CoreFact => typeof core === "object" && core !== null,
  );
}

function getFairings(enrichment: Record<string, unknown> | null): FairingsFact | null {
  const fairings = enrichment?.fairings;
  return typeof fairings === "object" && fairings !== null ? (fairings as FairingsFact) : null;
}

function getDataSources(enrichment: Record<string, unknown> | null): string {
  const sources = ["LL2"];
  if (enrichment && Array.isArray(enrichment.cores)) sources.push("SpaceX");
  if (enrichment && enrichment.nasaImage) sources.push("NASA");
  return sources.join(" + ");
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = n % 100;
  return `${n}${suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-faint">{label}</div>
      <div className="mt-1 text-ink-row">{value}</div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink-row">{value}</dd>
    </div>
  );
}

export default async function LaunchDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const launch = await getLaunchBySlug(slug);
  if (!launch) notFound();

  const missionName = getMissionName(launch.name);
  const cores = getCores(launch.enrichment);
  const fairings = getFairings(launch.enrichment);
  const moreLaunches = launch.agencyId
    ? await getMoreLaunchesFromAgency(launch.agencyId, launch.id)
    : [];
  // "More from <X>" means "more launches by the operator specifically"
  // (that's what getMoreLaunchesFromAgency queried by), not every
  // stakeholder — see lib/format.ts#getOperatorName.
  const operatorName = getOperatorName(launch.providerName);

  return (
    <AppShell active="Launches">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link href="/launches" className="hover:text-ink">
            Launches
          </Link>
          <IconChevronRight size={14} stroke={1.75} />
          <span className="text-ink">{missionName}</span>
        </div>

        <section
          className="relative overflow-hidden rounded-xl border p-8"
          style={{
            borderColor: "var(--color-line-blue)",
            background: "linear-gradient(135deg, var(--color-hero-from), var(--color-hero-to))",
          }}
        >
          <IconRocket
            size={96}
            stroke={1}
            className="pointer-events-none absolute right-8 top-8 text-line opacity-60"
          />

          <div className="flex items-center gap-3">
            {/* The hero chip is the operator only — matches the dashboard's
              * next-launch chip. The full stakeholder list (when there's
              * more than one) is in Mission Facts' "Provider" row below. */}
            <span className="rounded-md border border-[--accent-stroke] bg-[--accent-fill] px-3 py-1 text-sm text-neon-300">
              {operatorName}
            </span>
            <StatusPill status={launch.status} />
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold uppercase text-ink">
            {missionName}
          </h1>

          {(launch.rocket || launch.missionType) && (
            <p className="mt-2 text-ink-muted">
              {[launch.rocket, launch.missionType].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-ink-muted">
            <span className="flex items-center gap-1.5">
              <IconCalendar size={15} stroke={1.75} />
              {formatFullDateTime(launch.net, launch.netPrecision)}
            </span>
            {launch.padLocation && (
              <span className="flex items-center gap-1.5">
                <IconMapPin size={15} stroke={1.75} />
                {launch.padName ? `${launch.padName}, ` : ""}
                {formatSite(launch.padLocation)}
              </span>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <section>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
                Mission
              </h2>
              <p className="leading-relaxed text-ink-row">
                {launch.missionDescription ?? "No mission description available."}
              </p>
            </section>

            {cores.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
                  Booster &amp; Landing
                </h2>
                <div className="flex flex-col gap-4 rounded-xl border border-line-soft bg-space-850 p-6">
                  {cores.map((core, index) => (
                    <div
                      key={index}
                      className={
                        index > 0 ? "grid grid-cols-2 gap-4 border-t border-line-faint pt-4" : "grid grid-cols-2 gap-4"
                      }
                    >
                      {cores.length > 1 && (
                        <div className="col-span-2 text-xs uppercase tracking-widest text-ink-faint">
                          Core {index + 1}
                        </div>
                      )}
                      {core.flight !== null && (
                        <Fact label="Flight number" value={`${ordinal(core.flight)} flight`} />
                      )}
                      {core.landingType && <Fact label="Landing type" value={core.landingType} />}
                      {core.landingAttempt !== null && (
                        <div>
                          <div className="text-xs uppercase tracking-widest text-ink-faint">
                            Landing outcome
                          </div>
                          <div className="mt-1">
                            {!core.landingAttempt ? (
                              <span className="text-ink-muted">No attempt</span>
                            ) : (
                              <StatusPill
                                status={
                                  core.landingSuccess === true
                                    ? "success"
                                    : core.landingSuccess === false
                                      ? "failure"
                                      : "tbd"
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {core.reused !== null && (
                        <Fact label="Booster reused" value={core.reused ? "Yes" : "No"} />
                      )}
                    </div>
                  ))}

                  {fairings && fairings.reused !== null && (
                    <div className="grid grid-cols-2 gap-4 border-t border-line-faint pt-4">
                      <Fact label="Fairing reused" value={fairings.reused ? "Yes" : "No"} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {moreLaunches.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
                  More from {operatorName}
                </h2>
                <div className="overflow-hidden rounded-xl border border-line-soft bg-space-850">
                  {moreLaunches.map((row, index) => (
                    <Link
                      key={row.id}
                      href={`/launches/${row.slug}`}
                      className={`flex items-center justify-between px-6 py-4 text-sm hover:bg-[--accent-fill] ${
                        index > 0 ? "border-t border-line-faint" : ""
                      }`}
                    >
                      <span className="text-ink-row">{getMissionName(row.name)}</span>
                      <span className="font-mono text-ink-soft">
                        {formatNet(row.net, row.netPrecision)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line-soft bg-space-850 p-6">
              <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
                Mission Facts
              </h2>
              <dl className="flex flex-col gap-3 text-sm">
                <FactRow label="Provider" value={launch.providerName} />
                <FactRow label="Rocket" value={launch.rocket} />
                <FactRow label="Orbit" value={launch.orbit ?? "—"} />
                <FactRow label="Pad" value={launch.padName ?? "—"} />
                <FactRow label="NET precision" value={capitalize(launch.netPrecision)} />
                <FactRow label="Data source" value={getDataSources(launch.enrichment)} />
              </dl>
            </div>

            {launch.webcastUrl && (
              <a
                href={launch.webcastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-md border border-neon-400 px-4 py-3 text-sm text-neon-400 hover:bg-[--accent-fill]"
              >
                <IconPlayerPlay size={16} stroke={1.75} />
                Watch webcast
              </a>
            )}

            <span
              title="Requires an account — not built yet"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line-soft px-4 py-3 text-sm text-ink-dim"
            >
              <IconBookmark size={16} stroke={1.75} />
              Add to watchlist
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
