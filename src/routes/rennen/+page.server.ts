import { getSeasonData } from '$lib/server/data';
import { calendarView } from '$lib/server/views';

export async function load() {
  return { calendar: calendarView(await getSeasonData()) };
}
