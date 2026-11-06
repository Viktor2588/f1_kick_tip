import { getSeasonData } from '$lib/server/data';
import { tipDeadlineCalendar } from '$lib/ics';

export async function GET({ url }) {
  const data = await getSeasonData();
  return new Response(tipDeadlineCalendar(data.races, data.year, url.origin), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="f1-kick-tip.ics"',
      'cache-control': 'public, max-age=3600',
    },
  });
}
