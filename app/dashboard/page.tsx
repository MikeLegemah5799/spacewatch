import Link from "next/link";
import { IconArrowRight, IconMapPin } from "@tabler/icons-react";
import { AppShell } from "@/components/app-shell";
import { CountdownTimer } from "@/components/countdown-timer";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { getDashboardStats, getNextLaunch, getUpcomingLaunches } from "@/lib/db/queries";
import { formatNet, getMissionName } from "@/lib/format";

export default async function DashboardPage() {
  const [nextLaunch, stats, upcoming] = await Promise.all([
    getNextLaunch(),
    getDashboardStats(),
    getUpcomingLaunches(4),
  ]);

  return (
    <AppShell active="Dashboard">
      <div className="flex flex-col gap-8">
        {nextLaunch ? (
          <section
            className="rounded-xl border p-8 shadow-[var(--shadow-glow)]"
            style={{
              borderColor: "var(--color-line-blue)",
              background:
                "linear-gradient(135deg, var(--color-hero-from), var(--color-hero-to))",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <div className="font-display text-xs font-semibold tracking-[0.2em] text-neon-400">
                  NEXT LAUNCH · T-MINUS
                </div>
                <h1 className="mt-3 font-display text-3xl font-bold text-ink">
                  <Link href={`/launches/${nextLaunch.slug}`} className="hover:text-neon-300">
                    {nextLaunch.rocket} · {getMissionName(nextLaunch.name)}
                  </Link>
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-md border border-[--accent-stroke] bg-[--accent-fill] px-3 py-1 text-neon-300">
                    {nextLaunch.providerName}
                  </span>
                  {nextLaunch.padLocation && (
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <IconMapPin size={15} stroke={1.75} />
                      {nextLaunch.padName ? `${nextLaunch.padName}, ` : ""}
                      {nextLaunch.padLocation}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                {nextLaunch.net && (
                  <CountdownTimer target={nextLaunch.net.toISOString()} />
                )}
                <StatusPill status={nextLaunch.status} />
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-line-soft bg-space-800 p-8 text-ink-muted">
            No upcoming launches yet — check back once the next ingestion run
            completes.
          </section>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatCard
            label="Launches tracked"
            value={stats.launchesTracked.toLocaleString()}
          />
          <StatCard
            label="Success rate"
            value={
              stats.successRate === null ? "—" : `${stats.successRate.toFixed(1)}%`
            }
            valueClassName="text-go"
          />
          <StatCard
            label="Upcoming · 30d"
            value={stats.upcomingIn30Days.toLocaleString()}
            valueClassName="text-neon-400"
          />
          <StatCard label="Agencies" value={stats.agencyCount.toLocaleString()} />
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold tracking-[0.15em] text-ink">
              UPCOMING LAUNCHES
            </h2>
            <Link
              href="/schedule"
              className="flex items-center gap-1.5 text-sm text-neon-400 hover:text-neon-300"
            >
              View schedule
              <IconArrowRight size={16} stroke={1.75} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-line-soft bg-space-850">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-ink-faint">
                  <th className="px-6 py-3 font-normal">Mission</th>
                  <th className="px-6 py-3 font-normal">Provider</th>
                  <th className="px-6 py-3 font-normal">NET</th>
                  <th className="px-6 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-ink-muted">
                      No upcoming launches yet.
                    </td>
                  </tr>
                ) : (
                  upcoming.map((launch) => (
                    <tr key={launch.id} className="border-t border-line-faint">
                      <td className="px-6 py-4 text-ink-row">
                        <Link href={`/launches/${launch.slug}`} className="hover:text-neon-300">
                          {getMissionName(launch.name)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-neon-400">
                        {launch.providerName}
                      </td>
                      <td className="px-6 py-4 font-mono text-ink-soft">
                        {formatNet(launch.net, launch.netPrecision)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusPill status={launch.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
