import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSeasonData } from '$lib/server/data';
import { issueLoginToken } from '$lib/server/auth';
import { saveChampions } from '$lib/server/results';
import { requireAdmin } from '$lib/server/guard';
import { formString } from '$lib/server/tips';

export async function load() {
  const data = await getSeasonData();
  const now = new Date();
  return {
    rounds: data.races.map(r => ({
      round: r.round, country: r.country, countryCode: r.countryCode, sprint: r.sprint, date: r.date,
      started: now >= new Date(r.raceStartUTC),
      hasResult: !!data.game.raceResults[r.round],
      hasSprintResult: !!data.game.sprintResults[r.round],
      tips: Object.keys(data.game.raceTips[r.round] ?? {}).length,
    })),
    champions: data.game.final ?? null,
  };
}

export const actions = {
  link: async ({ locals, request, url }) => {
    requireAdmin(locals);
    const playerId = formString(await request.formData(), 'player');
    try {
      const token = await issueLoginToken(await getDb(), playerId);
      return { linkFor: playerId, link: `${url.origin}/login/${token}` };
    } catch {
      return fail(404, { message: 'Unbekannter Spieler.' });
    }
  },
  champions: async ({ locals, request }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const res = await saveChampions(await getDb(), await getSeasonData(), formString(form, 'wdc'), formString(form, 'wcc'));
    if (!res.ok) return fail(res.status, { message: res.message });
    return { championsSaved: true };
  },
};
