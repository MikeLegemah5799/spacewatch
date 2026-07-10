import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { ScheduleList } from "@/components/schedule-list";
import { getScheduleLaunches, getScheduleLaunchesForMonth, getUpcomingCount } from "@/lib/db/queries";

function parseMonthParam(value: string | undefined): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) - 1 };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";

  const upcomingIn30Days = await getUpcomingCount(30);

  return (
    <AppShell active="Schedule">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Schedule</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {upcomingIn30Days.toLocaleString()} launches in the next 30 days
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/schedule?view=list"
              className={
                view === "list"
                  ? "rounded-md border border-neon-400 px-4 py-2 text-sm text-neon-400 font-semibold"
                  : "rounded-md border border-line-soft px-4 py-2 text-sm text-ink-muted hover:text-ink"
              }
            >
              List
            </Link>
            <Link
              href="/schedule?view=calendar"
              className={
                view === "calendar"
                  ? "rounded-md border border-neon-400 px-4 py-2 text-sm text-neon-400 font-semibold"
                  : "rounded-md border border-line-soft px-4 py-2 text-sm text-ink-muted hover:text-ink"
              }
            >
              Calendar
            </Link>
          </div>
        </div>

        {view === "calendar" ? (
          <CalendarSection monthParam={params.month} />
        ) : (
          <ListSection />
        )}
      </div>
    </AppShell>
  );
}

async function ListSection() {
  const rows = await getScheduleLaunches();
  return <ScheduleList rows={rows} />;
}

async function CalendarSection({ monthParam }: { monthParam: string | undefined }) {
  const { year, month } = parseMonthParam(monthParam);
  const rows = await getScheduleLaunchesForMonth(year, month);
  return <ScheduleCalendar year={year} month={month} launches={rows} />;
}
