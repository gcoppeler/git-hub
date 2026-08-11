import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy initialization: `neon()` throws if DATABASE_URL is unset, and Next.js
// evaluates top-level module code at build time — a plain module-level call
// would crash `next build` before env vars are provisioned. Do NOT wrap this
// in a JS Proxy; that breaks libraries that introspect the client shape.
function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

export * as schema from "./schema";
