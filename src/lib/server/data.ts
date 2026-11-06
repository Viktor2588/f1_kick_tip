import { getDb } from './db';
import { loadSeason } from './season';
import { CURRENT_SEASON, lookups } from './views';

/** Full season incl. all tips. Server only: never return this object to the browser as-is. */
export async function getSeasonData() {
  return loadSeason(await getDb(), CURRENT_SEASON);
}

/** Public reference data the browser may have: players, drivers, teams. */
export function publicMeta(data: Awaited<ReturnType<typeof getSeasonData>>) {
  return { year: data.year, players: data.players, ...lookups(data) };
}
