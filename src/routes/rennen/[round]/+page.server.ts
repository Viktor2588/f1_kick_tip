import { error } from '@sveltejs/kit';
import { getSeasonData } from '$lib/server/data';
import { raceView } from '$lib/server/views';

export async function load({ params }) {
  const round = Number(params.round);
  const view = Number.isInteger(round) ? raceView(await getSeasonData(), round) : null;
  if (!view) error(404, 'Rennen nicht gefunden');
  return { view };
}
