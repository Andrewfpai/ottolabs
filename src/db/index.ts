/**
 * Drizzle client, backed by Neon over WebSockets.
 *
 * We deliberately use `neon-serverless` (WebSocket Pool) rather than
 * `neon-http`. The HTTP driver cannot do real multi-statement transactions,
 * and finishing a focus session is a multi-write operation that must not be
 * able to half-apply.
 *
 * The client is built eagerly and must be a genuine Drizzle instance: the
 * Auth.js adapter identifies the dialect with `is(db, PgDatabase)`, which walks
 * the prototype chain, so a lazy Proxy wrapper fails that check. Building
 * eagerly costs nothing — `new Pool()` only stores config, and no socket is
 * opened until the first query.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

// Node 22+ ships a global WebSocket; older runtimes need the `ws` polyfill.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const MISSING_URL_MESSAGE =
  "DATABASE_URL is not set. Copy .env.example to .env.local and paste your " +
  "Neon connection string (use the `dev` branch locally).";

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  // Do not throw here. `next build` evaluates this module while collecting
  // page data, and a hard failure would make the app unbuildable on any
  // machine that has not set up Neon yet. The placeholder lets construction
  // succeed; the first real query fails, by which point this warning is in the
  // log explaining exactly why.
  console.error(`[db] ${MISSING_URL_MESSAGE}`);
  return "postgresql://unset:unset@db-url-not-configured.invalid/unset";
}

// Next.js hot-reloads modules in dev; without a singleton every reload would
// open a fresh pool and exhaust Neon's connection limit within minutes.
const globalForDb = globalThis as unknown as {
  __ottoPool?: Pool;
  __ottoDb?: NeonDatabase<typeof schema>;
};

const pool = globalForDb.__ottoPool ?? new Pool({ connectionString: resolveConnectionString() });

export type Db = NeonDatabase<typeof schema>;

export const db: Db = globalForDb.__ottoDb ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ottoPool = pool;
  globalForDb.__ottoDb = db;
}

export { schema };
