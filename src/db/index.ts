import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type AppDb = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  readonlyPool: Pool | undefined;
  readonlyDrizzle: AppDb | undefined;
};

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString: url });
}

export function getPool(): Pool {
  if (!globalForDb.pool) {
    globalForDb.pool = createPool();
  }
  return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });

/** Reads via `DATABASE_URL_READONLY` when set; otherwise the primary pool (e.g. CI without a readonly role). */
export function getReadonlyDb(): AppDb {
  const roUrl = process.env.DATABASE_URL_READONLY;
  if (!roUrl) {
    return db;
  }
  if (!globalForDb.readonlyPool) {
    globalForDb.readonlyPool = new Pool({ connectionString: roUrl });
  }
  if (!globalForDb.readonlyDrizzle) {
    globalForDb.readonlyDrizzle = drizzle(globalForDb.readonlyPool, { schema });
  }
  return globalForDb.readonlyDrizzle;
}

export * from "./schema";
