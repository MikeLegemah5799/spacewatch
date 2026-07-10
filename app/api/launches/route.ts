/* ==================================================================
 * app/api/launches/route.ts  —  client-side filtering / search JSON
 * ------------------------------------------------------------------
 * Backs the interactive search/filter/sort/pagination controls on
 * /launches. Reads only from Postgres — never calls a third-party
 * launch API (see code-standards.md).
 * ================================================================== */

import { getLaunchesPage, type LaunchesQuery } from "@/lib/db/queries";

const VALID_OUTCOMES = new Set(["success", "failure"]);
const VALID_SORTS = new Set(["newest", "oldest"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const outcomeParam = searchParams.get("outcome");
  const sortParam = searchParams.get("sort");
  const pageParam = Number(searchParams.get("page"));
  const pageSizeParam = Number(searchParams.get("pageSize"));

  const query: LaunchesQuery = {
    search: searchParams.get("search") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    outcome: outcomeParam && VALID_OUTCOMES.has(outcomeParam) ? (outcomeParam as "success" | "failure") : undefined,
    sort: sortParam && VALID_SORTS.has(sortParam) ? (sortParam as "newest" | "oldest") : undefined,
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined,
    pageSize: Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : undefined,
  };

  const result = await getLaunchesPage(query);
  return Response.json(result);
}
