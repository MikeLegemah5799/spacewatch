import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { getAgencyBySlug, getAgencyLaunches, getAgencyStats } from "@/lib/db/queries";
import { formatNet, getMissionName } from "@/lib/format";

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);
  if (!agency) notFound();

  const [stats, recentLaunches] = await Promise.all([
    getAgencyStats(agency.id),
    getAgencyLaunches(agency.id),
  ]);

  return (
    <AppShell active="Agencies">
      <div className="flex flex-col gap-6">
        <Link
          href="/agencies"
          className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <IconArrowLeft size={16} stroke={1.75} />
          All agencies
        </Link>

        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{agency.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[agency.type, agency.countryCode].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:max-w-md">
          <StatCard label="Launches tracked" value={stats.totalLaunches.toLocaleString()} />
          <StatCard
            label="Success rate"
            value={stats.successRate === null ? "—" : `${stats.successRate.toFixed(1)}%`}
            valueClassName="text-go"
          />
        </div>

        <section>
          <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
            Recent Launches
          </h2>

          <div className="overflow-hidden rounded-xl border border-line-soft bg-space-850">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-ink-faint">
                  <th className="px-6 py-3 font-normal">Mission</th>
                  <th className="px-6 py-3 font-normal">NET</th>
                  <th className="px-6 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLaunches.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-ink-muted">
                      No launches recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentLaunches.map((launch) => (
                    <tr key={launch.id} className="border-t border-line-faint">
                      <td className="px-6 py-4 text-ink-row">{getMissionName(launch.name)}</td>
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
