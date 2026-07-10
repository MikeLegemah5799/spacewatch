import { AppShell } from "@/components/app-shell";

export default function SchedulePage() {
  return (
    <AppShell active="Schedule">
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Schedule</h1>
        <p className="max-w-md text-ink-muted">
          The full upcoming-launch schedule is coming in a later unit.
        </p>
      </div>
    </AppShell>
  );
}
