import Link from "next/link";
import { IconBell, IconRocket, IconSearch, IconUserCircle } from "@tabler/icons-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/launches", label: "Launches" },
  { href: "/schedule", label: "Schedule" },
  { href: "/agencies", label: "Agencies" },
] as const;

export type NavActive = (typeof NAV_LINKS)[number]["label"];

export function Nav({ active }: { active: NavActive }) {
  return (
    <header className="flex items-center justify-between border-b border-line-soft bg-space-900 px-8 py-4">
      <div className="flex items-center gap-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-wide text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[--accent-stroke] text-neon-400">
            <IconRocket size={18} stroke={1.75} />
          </span>
          SPACE WATCH
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.label === active
                  ? "border-b-2 border-neon-400 pb-1 text-neon-400"
                  : "border-b-2 border-transparent pb-1 text-ink-muted hover:text-ink"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-5 text-ink-muted">
        <IconSearch size={19} stroke={1.75} />
        <IconBell size={19} stroke={1.75} />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-space-700 text-neon-300">
          <IconUserCircle size={20} stroke={1.75} />
        </span>
      </div>
    </header>
  );
}
