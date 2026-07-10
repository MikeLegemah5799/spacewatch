import type { Launch } from "@/lib/db";

/**
 * Mission names are ingested as "<rocket> | <mission>" (see lib/db/schema.ts
 * comment on `launches.name`). The UI only ever shows the mission half.
 */
export function getMissionName(name: string): string {
  const parts = name.split("|");
  return parts.length > 1 ? parts[parts.length - 1].trim() : name.trim();
}

export function formatNet(
  net: Date | null,
  precision: Launch["netPrecision"],
): string {
  if (!net) return "TBD";

  switch (precision) {
    case "year":
      return net.getUTCFullYear().toString();
    case "quarter":
      return `Q${Math.floor(net.getUTCMonth() / 3) + 1}`;
    case "month":
      return net.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    default:
      return net.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        timeZone: "UTC",
      });
  }
}
