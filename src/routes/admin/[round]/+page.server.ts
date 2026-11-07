import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { raceByRound, season } from '$lib/domain/season';
import { validateRaceResult, validateSprintResult } from '$lib/domain/validate';
import { getStore, now } from '$lib/server/config';

function guard(locals: App.Locals, param: string) {
  if (!locals.isAdmin) error(403, 'Nur für Admins');
  const race = raceByRound(Number(param));
  if (!race) error(404, 'Unbekannte Runde');
  return race;
}

export const load: PageServerLoad = ({ params, locals }) => ({ round: guard(locals, params.round).round });

export const actions: Actions = {
  race: async ({ params, locals, request }) => {
    const race = guard(locals, params.round);
    const f = await request.formData();
    const v = validateRaceResult(season, race.round, {
      podium: [f.get('p1'), f.get('p2'), f.get('p3')], pole: f.get('pole'), fastestLap: f.get('fastestLap'),
      bestConstructor: f.get('bestConstructor'), dnfList: f.getAll('dnf'), dnsList: f.getAll('dns'),
      topTen: f.has('topTen') ? f.getAll('topTen') : undefined,
    }, now().toISOString());
    if (!v.ok) return fail(400, { kind: 'race', error: v.error });
    await getStore().saveRaceResult(race.round, v.value);
    return { kind: 'race', saved: true };
  },
  deleteRace: async ({ params, locals }) => {
    const race = guard(locals, params.round);
    await getStore().deleteRaceResult(race.round);
    return { kind: 'race', deleted: true };
  },
  sprint: async ({ params, locals, request }) => {
    const race = guard(locals, params.round);
    if (!race.sprint) return fail(400, { kind: 'sprint', error: 'Kein Sprint' });
    const f = await request.formData();
    const v = validateSprintResult(season, { podium: [f.get('p1'), f.get('p2'), f.get('p3')] }, now().toISOString());
    if (!v.ok) return fail(400, { kind: 'sprint', error: v.error });
    await getStore().saveSprintResult(race.round, v.value);
    return { kind: 'sprint', saved: true };
  },
  deleteSprint: async ({ params, locals }) => {
    const race = guard(locals, params.round);
    await getStore().deleteSprintResult(race.round);
    return { kind: 'sprint', deleted: true };
  },
};
