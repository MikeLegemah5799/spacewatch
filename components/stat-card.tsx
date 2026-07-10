export function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-space-800 px-6 py-5">
      <div className="text-sm text-ink-muted">{label}</div>
      <div
        className={`mt-2 font-display text-3xl font-bold ${valueClassName ?? "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}
