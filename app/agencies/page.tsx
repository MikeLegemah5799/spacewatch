import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getAgenciesList } from "@/lib/db/queries";

// Same reasoning as /launches — no dynamic signal, so this would otherwise
// be frozen at build-time data and never reflect newly-ingested agencies
// or launch counts.
export const revalidate = 300;

export default async function AgenciesPage() {
  const agencyRows = await getAgenciesList();

  return (
    <AppShell active="Agencies">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Agencies</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {agencyRows.length.toLocaleString()} agencies tracked
          </p>
        </div>

        {agencyRows.length === 0 ? (
          <div className="rounded-xl border border-line-soft bg-space-800 p-8 text-center text-ink-muted">
            No agencies yet — check back once the next ingestion run completes.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencyRows.map((agency) => (
              <Link
                key={agency.id}
                href={`/agencies/${agency.id}`}
                className="rounded-xl border border-line-soft bg-space-800 p-5 transition-colors hover:border-neon-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-bold text-ink">{agency.name}</div>
                    {agency.type && (
                      <div className="mt-1 text-xs text-ink-muted">{agency.type}</div>
                    )}
                  </div>
                  {agency.countryCode && (
                    <span className="rounded-md border border-line-soft px-2 py-0.5 text-xs text-ink-soft">
                      {agency.countryCode}
                    </span>
                  )}
                </div>
                <div className="mt-4 font-display text-2xl font-bold text-neon-400">
                  {agency.launchCount.toLocaleString()}
                </div>
                <div className="text-xs text-ink-muted">launches tracked</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
