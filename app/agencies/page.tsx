import { AppShell } from "@/components/app-shell";

export default function AgenciesPage() {
  return (
    <AppShell active="Agencies">
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Agencies</h1>
        <p className="max-w-md text-ink-muted">
          Per-agency launch pages are coming in a later unit.
        </p>
      </div>
    </AppShell>
  );
}
