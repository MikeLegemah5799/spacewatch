import { AppShell } from "@/components/app-shell";
import { LaunchesBrowser } from "@/components/launches-browser";
import { getLaunchesPage, getLaunchesSummary, getTopProviders } from "@/lib/db/queries";

export default async function LaunchesPage() {
  const [initial, summary, topProviders] = await Promise.all([
    getLaunchesPage(),
    getLaunchesSummary(),
    getTopProviders(3),
  ]);

  return (
    <AppShell active="Launches">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Launches</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {summary.totalLaunches.toLocaleString()} launches tracked across{" "}
            {summary.agencyCount.toLocaleString()} agencies
          </p>
        </div>

        <LaunchesBrowser initial={initial} providers={topProviders} />
      </div>
    </AppShell>
  );
}
