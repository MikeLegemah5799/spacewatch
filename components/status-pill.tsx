import type { Launch } from "@/lib/db";

const STATUS_CONFIG: Record<
  Launch["status"],
  { label: string; textClass: string; borderVar: string }
> = {
  go: { label: "GO", textClass: "text-go", borderVar: "--go-stroke" },
  success: { label: "SUCCESS", textClass: "text-go", borderVar: "--go-stroke" },
  tbd: { label: "TBD", textClass: "text-tbd", borderVar: "--tbd-stroke" },
  hold: { label: "HOLD", textClass: "text-tbd", borderVar: "--tbd-stroke" },
  in_flight: {
    label: "LIVE",
    textClass: "text-neon-300",
    borderVar: "--accent-stroke",
  },
  failure: {
    label: "FAILURE",
    textClass: "text-fail",
    borderVar: "--fail-stroke",
  },
};

export function StatusPill({ status }: { status: Launch["status"] }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-display text-[11px] tracking-wide ${config.textClass}`}
      style={{ borderColor: `var(${config.borderVar})` }}
    >
      {config.label}
    </span>
  );
}
