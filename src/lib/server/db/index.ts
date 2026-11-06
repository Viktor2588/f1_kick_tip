import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { mkdirSync } from 'node:fs';
import * as schema from './schema';

export type Db = PgliteDatabase<typeof schema>;

/** Opens a database. `dataDir` undefined = in-memory (tests). */
export async function openDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await client.exec(schema.DDL);
  return drizzle({ client, schema });
}

let shared: Promise<Db> | null = null;

/**
 * The app's database. Locally an embedded Postgres in .data/pglite (override with PGLITE_DIR).
 * Production (Neon) is wired up at cut-over; credentials then come only from server env vars.
 */
export function getDb(): Promise<Db> {
  if (!shared) {
    shared = (async () => {
      const db = await openDb(process.env.PGLITE_DIR || '.data/pglite');
      const { ensureSeeded } = await import('./seed');
      await ensureSeeded(db);
      return db;
    })();
  }
  return shared;
}
