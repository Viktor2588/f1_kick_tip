import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { raceByRound, season } from '$lib/domain/season';
import { deadlineOf, isOpen } from '$lib/domain/schedule';
import { validateRaceTip, validateSprintTip } from '$lib/domain/validate';
import { getStore, now } from '$lib/server/config';

function raceOr404(param: string) {
  const race = raceByRound(Number(param));
  if (!race) error(404, 'Diese Runde gibt es nicht');
  return race;
}

export const load: PageServerLoad = ({ params }) => ({ round: raceOr404(params.round).round });

const podiumFrom = (f: FormData) => [f.get('p1'), f.get('p2'), f.get('p3')];

export const actions: Actions = {
  race: async ({ params, request, locals }) => {
    const race = raceOr404(params.round);
    if (!locals.playerId) return fail(401, { kind: 'race', error: 'Bitte zuerst anmelden' });
    const t = now();
    if (!isOpen(deadlineOf(season, 'race', race), t)) return fail(409, { kind: 'race', error: 'Das Rennen hat schon begonnen. Tipps sind gesperrt.' });
    const f = await request.formData();
    const v = validateRaceTip(season, race.round, {
      podium: podiumFrom(f), pole: f.get('pole'), fastestLap: f.get('fastestLap'),
      bestConstructor: f.get('bestConstructor'), dnf: f.get('dnf'), dns: f.get('dns'),
    }, t.toISOString());
    if (!v.ok) return fail(400, { kind: 'race', error: v.error });
    await getStore().saveRaceTip(race.round, locals.playerId, v.value);
    return { kind: 'race', saved: true };
  },

  sprint: async ({ params, request, locals }) => {
    const race = raceOr404(params.round);
    if (!race.sprint) return fail(400, { kind: 'sprint', error: 'Kein Sprint an diesem Wochenende' });
    if (!locals.playerId) return fail(401, { kind: 'sprint', error: 'Bitte zuerst anmelden' });
    const t = now();
    if (!isOpen(deadlineOf(season, 'sprint', race), t)) return fail(409, { kind: 'sprint', error: 'Der Sprint hat schon begonnen. Tipps sind gesperrt.' });
    const f = await request.formData();
    const v = validateSprintTip(season, { podium: podiumFrom(f) }, t.toISOString());
    if (!v.ok) return fail(400, { kind: 'sprint', error: v.error });
    await getStore().saveSprintTip(race.round, locals.playerId, v.value);
    return { kind: 'sprint', saved: true };
  },
};
