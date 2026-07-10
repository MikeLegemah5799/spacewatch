/* ==================================================================
 * lib/db/index.ts  —  the client used at runtime
 * ------------------------------------------------------------------
 * Uses the POOLED connection string. Vercel Neon injects both
 * DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (direct).
 * Serverless functions must use the pooled one or you'll exhaust
 * connections under cron + request load.
 * ================================================================== */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export * from "./schema";