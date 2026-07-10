import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import type { ScheduleLaunchRow } from "@/lib/db/queries";
import { formatNet, formatSite, getMissionName } from "@/lib/format";

interface MonthGroup {
  key: string;
  label: string;
  rows: ScheduleLaunchRow[];
}

/** Rows arrive pre-sorted by NET (nulls last), so a single pass preserves
 * chronological order across groups, with any date-less launches trailing
 * in their own group. */
function groupByMonth(rows: ScheduleLaunchRow[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();

  for (const row of rows) {
    const key = row.net ? `${row.net.getUTCFullYear()}-${row.net.getUTCMonth()}` : "tbd";

    let group = byKey.get(key);
    if (!group) {
      const label = row.net
        ? row.net.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        : "Date TBD";
      group = { key, label, rows: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }

  return groups;
}

export function ScheduleList({ rows }: { rows: ScheduleLaunchRow[] }) {
  const groups = groupByMonth(rows);
  const nextLaunchId = rows[0]?.id;

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-line-soft bg-space-800 p-8 text-center text-ink-muted">
        No upcoming launches yet — check back once the next ingestion run
        completes.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.key} className="flex flex-col gap-3">
          <h2
            className={`font-display text-sm font-semibold uppercase tracking-[0.15em] ${
              index === 0 ? "text-neon-400" : "text-ink-muted"
            }`}
          >
            {group.label}
          </h2>

          <div className="overflow-hidden rounded-xl border border-line-soft bg-space-850">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-ink-faint">
                  <th className="px-6 py-3 font-normal">NET</th>
                  <th className="px-6 py-3 font-normal">Mission</th>
                  <th className="px-6 py-3 font-normal">Provider</th>
                  <th className="px-6 py-3 font-normal">Site</th>
                  <th className="px-6 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-line-faint ${
                      row.id === nextLaunchId ? "bg-[--accent-fill]" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-ink-soft">
                      {formatNet(row.net, row.netPrecision)}
                    </td>
                    <td className="px-6 py-4 text-ink-row">
                      <Link href={`/launches/${row.slug}`} className="hover:text-neon-300">
                        {getMissionName(row.name)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-neon-400">{row.providerName}</td>
                    <td className="px-6 py-4 text-ink-soft">{formatSite(row.padLocation)}</td>
                    <td className="px-6 py-4 text-right">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
