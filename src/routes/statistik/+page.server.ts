import { getSeasonData } from '$lib/server/data';
import { statsView } from '$lib/server/stats';

export async function load() {
  return { stats: statsView(await getSeasonData()) };
}
