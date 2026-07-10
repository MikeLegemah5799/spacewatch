import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { getAgencyBySlug, getAgencyLaunchesPage, getAgencyStats } from "@/lib/db/queries";
import { formatNet, getMissionName, getPageWindow } from "@/lib/format";

export default async function AgencyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const agency = await getAgencyBySlug(slug);
  if (!agency) notFound();

  const page = Number(pageParam) || 1;

  const [stats, launchesPage] = await Promise.all([
    getAgencyStats(agency.id),
    getAgencyLaunchesPage(agency.id, page),
  ]);

  const totalPages = Math.max(1, Math.ceil(launchesPage.total / launchesPage.pageSize));

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

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
              Launches
            </h2>
            {launchesPage.total > 0 && (
              <span className="text-sm text-ink-muted">
                {launchesPage.total.toLocaleString()} total
              </span>
            )}
          </div>

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
                {launchesPage.launches.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-ink-muted">
                      No launches recorded yet.
                    </td>
                  </tr>
                ) : (
                  launchesPage.launches.map((launch) => (
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

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <PageLink slug={agency.id} page={launchesPage.page - 1} disabled={launchesPage.page <= 1}>
                Prev
              </PageLink>
              {getPageWindow(launchesPage.page, totalPages).map((p) => (
                <PageLink key={p} slug={agency.id} page={p} active={p === launchesPage.page}>
                  {p}
                </PageLink>
              ))}
              <PageLink
                slug={agency.id}
                page={launchesPage.page + 1}
                disabled={launchesPage.page >= totalPages}
              >
                Next
              </PageLink>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PageLink({
  slug,
  page,
  active,
  disabled,
  children,
}: {
  slug: string;
  page: number;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-line-soft px-3 py-1.5 text-ink-dim opacity-40">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/agencies/${slug}?page=${page}`}
      className={
        active
          ? "rounded-md border border-neon-400 px-3 py-1.5 text-neon-400"
          : "rounded-md border border-line-soft px-3 py-1.5 text-ink-muted hover:text-ink"
      }
    >
      {children}
    </Link>
  );
}
