import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="font-display text-3xl font-bold text-neon-400">404</div>
        <h1 className="font-display text-xl font-bold text-ink">Page not found</h1>
        <p className="max-w-sm text-ink-muted">
          The page you&apos;re looking for doesn&apos;t exist, or the launch/agency it
          referenced may have been renamed or removed.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 rounded-md border border-neon-400 px-4 py-2 text-sm text-neon-400 hover:bg-[--accent-fill]"
        >
          Back to dashboard
        </Link>
      </div>
    </AppShell>
  );
}
