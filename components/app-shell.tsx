import type { ReactNode } from "react";
import { Nav, type NavActive } from "@/components/nav";

export function AppShell({
  active,
  children,
}: {
  active: NavActive;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen justify-center bg-void p-6">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-line bg-space-950 shadow-[var(--shadow-ring)]">
        <Nav active={active} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
