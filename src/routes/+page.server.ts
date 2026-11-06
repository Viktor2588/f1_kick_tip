import { getSeasonData } from '$lib/server/data';
import { dashboardView, standingsView } from '$lib/server/views';

export async function load() {
  const data = await getSeasonData();
  return { dash: dashboardView(data), table: standingsView(data) };
}
