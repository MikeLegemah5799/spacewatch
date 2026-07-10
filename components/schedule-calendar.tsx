import Link from "next/link";
import { STATUS_CONFIG } from "@/components/status-pill";
import type { ScheduleLaunchRow } from "@/lib/db/queries";
import { getMissionName } from "@/lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** `month` is 0-indexed (matches `Date#getUTCMonth`). */
export function ScheduleCalendar({
  year,
  month,
  launches,
}: {
  year: number;
  month: number;
  launches: ScheduleLaunchRow[];
}) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = firstOfMonth.getUTCDay();

  const byDay = new Map<number, ScheduleLaunchRow[]>();
  for (const launch of launches) {
    if (!launch.net) continue;
    const day = launch.net.getUTCDate();
    const list = byDay.get(day);
    if (list) {
      list.push(launch);
    } else {
      byDay.set(day, [launch]);
    }
  }

  const now = new Date();
  const isCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() === month;
  const todayDate = now.getUTCDate();

  const prevMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to a full last row so every cell is an explicit blank `div` rather
  // than empty grid track — otherwise the corner clips oddly against the
  // container's rounded border.
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <Link
          href={`/schedule?view=calendar&month=${monthParam(prevMonth.year, prevMonth.month)}`}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line-soft text-ink-muted hover:text-ink"
        >
          ‹
        </Link>
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.15em] text-ink">
          {monthLabel}
        </h2>
        <Link
          href={`/schedule?view=calendar&month=${monthParam(nextMonth.year, nextMonth.month)}`}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line-soft text-ink-muted hover:text-ink"
        >
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line-soft bg-line-faint">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-space-850 px-3 py-2 text-center text-xs uppercase tracking-widest text-ink-faint"
          >
            {day}
          </div>
        ))}

        {cells.map((day, index) =>
          day === null ? (
            <div key={`blank-${index}`} className="min-h-[110px] bg-space-950" />
          ) : (
            <div
              key={day}
              className={`flex min-h-[110px] flex-col gap-1.5 bg-space-850 p-2 ${
                isCurrentMonth && day === todayDate ? "ring-1 ring-inset ring-neon-400" : ""
              }`}
            >
              <span
                className={`text-sm ${
                  isCurrentMonth && day === todayDate ? "font-bold text-neon-400" : "text-ink-muted"
                }`}
              >
                {day}
              </span>
              {(byDay.get(day) ?? []).slice(0, MAX_CHIPS_PER_DAY).map((launch) => {
                const config = STATUS_CONFIG[launch.status];
                return (
                  <span
                    key={launch.id}
                    title={getMissionName(launch.name)}
                    className={`truncate rounded-md border px-2 py-1 text-xs ${config.textClass}`}
                    style={{ borderColor: `var(${config.borderVar})` }}
                  >
                    {getMissionName(launch.name)}
                  </span>
                );
              })}
              {(byDay.get(day)?.length ?? 0) > MAX_CHIPS_PER_DAY && (
                <span className="text-xs text-ink-dim">
                  +{(byDay.get(day)?.length ?? 0) - MAX_CHIPS_PER_DAY} more
                </span>
              )}
            </div>
          ),
        )}
      </div>

      <div className="flex items-center gap-6 text-sm text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-go" />
          Go
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-tbd" />
          TBD
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm border border-neon-400" />
          Today
        </span>
      </div>
    </div>
  );
}
