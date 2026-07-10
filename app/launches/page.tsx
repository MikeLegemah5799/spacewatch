import { AppShell } from "@/components/app-shell";

export default function LaunchesPage() {
  return (
    <AppShell active="Launches">
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Launches</h1>
        <p className="max-w-md text-ink-muted">
          The searchable historical archive is coming in a later unit.
        </p>
      </div>
    </AppShell>
  );
}
