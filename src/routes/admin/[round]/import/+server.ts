import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { raceByRound } from '$lib/domain/season';
import { importRace, importSprint } from '$lib/server/jolpica';

export const GET: RequestHandler = async ({ params, locals, fetch, url }) => {
  if (!locals.isAdmin) error(403, 'Nur für Admins');
  const race = raceByRound(Number(params.round));
  if (!race) error(404, 'Unbekannte Runde');
  try {
    if (url.searchParams.get('kind') === 'sprint') {
      return json({ sprint: await importSprint(race.round, fetch) });
    }
    return json({ race: await importRace(race.round, fetch) });
  } catch (e) {
    return json({ error: `F1-API nicht erreichbar (${(e as Error).message})` }, { status: 502 });
  }
};
