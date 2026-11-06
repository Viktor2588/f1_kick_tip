import { getSeasonData, publicMeta } from '$lib/server/data';

export async function load({ locals }) {
  const data = await getSeasonData();
  return { meta: publicMeta(data), me: locals.player ?? null };
}
