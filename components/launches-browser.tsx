"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { StatusPill } from "@/components/status-pill";
import type { LaunchesPageResult } from "@/lib/db/queries";
import { formatNet, getMissionName, getPageWindow } from "@/lib/format";

type OutcomeFilter = "success" | "failure" | null;
type SortOrder = "newest" | "oldest";

function chipClass(active: boolean) {
  return active
    ? "rounded-md border border-neon-400 px-4 py-2 text-sm text-neon-400"
    : "rounded-md border border-line-soft px-4 py-2 text-sm text-ink-muted hover:text-ink";
}

export function LaunchesBrowser({
  initial,
  providers,
}: {
  initial: LaunchesPageResult;
  providers: string[];
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [provider, setProviderState] = useState<string | null>(null);
  const [outcome, setOutcomeState] = useState<OutcomeFilter>(null);
  const [sort, setSortState] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LaunchesPageResult>(initial);
  const [loading, setLoading] = useState(false);

  const skipNextFetch = useRef(true);

  // Debounce the search box, and fold the page reset into the same delayed
  // update so it doesn't fire an extra fetch of its own.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (skipNextFetch.current) {
      // Skip the initial mount — `initial` already reflects these defaults.
      skipNextFetch.current = false;
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (provider) params.set("provider", provider);
    if (outcome) params.set("outcome", outcome);
    if (sort !== "newest") params.set("sort", sort);

    fetch(`/api/launches?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<LaunchesPageResult>) : null))
      .then((json) => {
        if (json) setData(json);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedSearch, provider, outcome, sort, page]);

  function setProvider(value: string | null) {
    setProviderState(value);
    setPage(1);
  }

  function setOutcome(value: OutcomeFilter) {
    setOutcomeState(value);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rangeStart = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.total, data.page * data.pageSize);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <IconSearch
          size={17}
          stroke={1.75}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-dim"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search missions..."
          className="w-full rounded-md border border-line-soft bg-space-850 py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-ink-dim focus:border-neon-400 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={chipClass(provider === null)} onClick={() => setProvider(null)}>
          All providers
        </button>
        {providers.map((name) => (
          <button
            key={name}
            type="button"
            className={chipClass(provider === name)}
            onClick={() => setProvider(name)}
          >
            {name}
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-line-soft" />

        <button type="button" className={chipClass(outcome === null)} onClick={() => setOutcome(null)}>
          All outcomes
        </button>
        <button
          type="button"
          className={chipClass(outcome === "success")}
          onClick={() => setOutcome("success")}
        >
          Success
        </button>
        <button
          type="button"
          className={chipClass(outcome === "failure")}
          onClick={() => setOutcome("failure")}
        >
          Failure
        </button>

        <div className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          <span>Sort:</span>
          <select
            value={sort}
            onChange={(e) => {
              setSortState(e.target.value as SortOrder);
              setPage(1);
            }}
            className="rounded-md border border-line-soft bg-space-850 px-3 py-1.5 text-sm text-ink focus:border-neon-400 focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-line-soft bg-space-850 transition-opacity ${loading ? "opacity-60" : ""}`}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-ink-faint">
              <th className="px-6 py-3 font-normal">Mission</th>
              <th className="px-6 py-3 font-normal">Provider</th>
              <th className="px-6 py-3 font-normal">Rocket</th>
              <th className="px-6 py-3 font-normal">Date</th>
              <th className="px-6 py-3 text-right font-normal">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {data.launches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-ink-muted">
                  No launches match these filters.
                </td>
              </tr>
            ) : (
              data.launches.map((launch) => (
                <tr key={launch.id} className="border-t border-line-faint">
                  <td className="px-6 py-4 text-ink-row">
                    <Link href={`/launches/${launch.slug}`} className="hover:text-neon-300">
                      {getMissionName(launch.name)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neon-400">{launch.providerName}</td>
                  <td className="px-6 py-4 text-ink-soft">{launch.rocket}</td>
                  <td className="px-6 py-4 font-mono text-ink-soft">
                    {formatNet(launch.net ? new Date(launch.net) : null, launch.netPrecision)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <StatusPill status={launch.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>
          {data.total === 0
            ? "No results"
            : `Showing ${rangeStart}–${rangeEnd} of ${data.total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-line-soft px-3 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          {getPageWindow(data.page, totalPages).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={
                p === data.page
                  ? "rounded-md border border-neon-400 px-3 py-1.5 text-neon-400"
                  : "rounded-md border border-line-soft px-3 py-1.5 hover:text-ink"
              }
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={data.page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-line-soft px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
