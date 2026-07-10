/* ==================================================================
 * drizzle.config.ts  —  project root
 * ------------------------------------------------------------------
 * Migrations use the DIRECT (unpooled) connection. PgBouncer-style
 * pooling doesn't support the session-level statements that DDL and
 * advisory locks need, so pointing drizzle-kit at the pooled URL
 * will fail or hang.
 * ================================================================== */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});