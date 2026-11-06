// First start: fill an empty local database.
// - Always: the 2026 calendar, teams, drivers and players from legacy/data/season.json.
// - Tips/results: the real export if present (private/live-export.json, never in git),
//   otherwise the old demo data (legacy/data/test) so the app has something to show.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { Db } from './index';
import { importLegacyRows, importSeason, legacyDataToRows, type LegacyRows } from './import';
import type { LegacyData, LegacySeasonFile } from '$lib/legacy-format';

const root = process.cwd();
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

export function seasonFile(): LegacySeasonFile {
  return readJson('legacy/data/season.json');
}

export function demoData(): LegacyData {
  const d = 'legacy/data/test/';
  return {
    season: readJson(d + 'season.json'),
    predictions: readJson(d + 'predictions.json'),
    sprintPredictions: readJson(d + 'sprint-predictions.json'),
    seasonPredictions: readJson(d + 'season-predictions.json'),
    results: readJson(d + 'results.json'),
    sprintResults: readJson(d + 'sprint-results.json'),
  };
}

export const LIVE_EXPORT = 'private/live-export.json';

export async function ensureSeeded(db: Db): Promise<'existing' | 'live-export' | 'demo'> {
  const { rows } = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM seasons`);
  if (rows[0].n > 0) return 'existing';

  const season = seasonFile();
  await importSeason(db, season);
  if (existsSync(join(root, LIVE_EXPORT))) {
    const rowsExport: LegacyRows = readJson(LIVE_EXPORT);
    await importLegacyRows(db, season.season, rowsExport);
    return 'live-export';
  }
  await importLegacyRows(db, season.season, legacyDataToRows(demoData()));
  return 'demo';
}
