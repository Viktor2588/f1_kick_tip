import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSeasonData } from '$lib/server/data';
import { requireAdmin } from '$lib/server/guard';
import { formString } from '$lib/server/tips';
import { DNF_FROM_ROUND, deleteRaceResult, deleteSprintResult, saveRaceResult, saveSprintResult } from '$lib/server/results';

function roundParam(raw: string) {
  const round = Number(raw);
  if (!Number.isInteger(round)) error(404, 'Rennen nicht gefunden');
  return round;
}

export async function load({ params, locals }) {
  requireAdmin(locals); // see admin/+page.server.ts
  const data = await getSeasonData();
  const round = roundParam(params.round);
  const race = data.races.find(r => r.round === round);
  if (!race) error(404, 'Rennen nicht gefunden');
  const now = new Date();
  // The admin also plays: other players' tips only become visible here once the race (or sprint) has started.
  const raceStarted = now >= new Date(race.raceStartUTC);
  const sprintStarted = !!race.sprintStartUTC && now >= new Date(race.sprintStartUTC);
  return {
    race,
    withLists: round >= DNF_FROM_ROUND,
    result: data.game.raceResults[round] ?? null,
    sprintResult: data.game.sprintResults[round] ?? null,
    raceStarted,
    tips: raceStarted ? data.game.raceTips[round] ?? {} : {},
    sprintTips: sprintStarted ? data.game.sprintTips[round] ?? {} : {},
  };
}

const list = (form: FormData, key: string) => form.getAll(key).filter((v): v is string => typeof v === 'string' && v !== '');

export const actions = {
  race: async ({ locals, params, request }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const res = await saveRaceResult(await getDb(), await getSeasonData(), roundParam(params.round), {
      winner: formString(form, 'winner'), p2: formString(form, 'p2'), p3: formString(form, 'p3'),
      pole: formString(form, 'pole'), fastestLap: formString(form, 'fastestLap'), bestConstructor: formString(form, 'bestConstructor'),
      dnf: list(form, 'dnf'), dns: list(form, 'dns'),
    });
    if (!res.ok) return fail(res.status, { form: 'race', message: res.message });
    return { form: 'race', saved: true };
  },
  sprint: async ({ locals, params, request }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const res = await saveSprintResult(await getDb(), await getSeasonData(), roundParam(params.round), {
      winner: formString(form, 'winner'), p2: formString(form, 'p2'), p3: formString(form, 'p3'),
    });
    if (!res.ok) return fail(res.status, { form: 'sprint', message: res.message });
    return { form: 'sprint', saved: true };
  },
  deleteRace: async ({ locals, params }) => {
    const me = requireAdmin(locals);
    const data = await getSeasonData();
    await deleteRaceResult(await getDb(), data.year, roundParam(params.round));
    return { form: 'race', deleted: true, by: me.id };
  },
  deleteSprint: async ({ locals, params }) => {
    requireAdmin(locals);
    const data = await getSeasonData();
    await deleteSprintResult(await getDb(), data.year, roundParam(params.round));
    return { form: 'sprint', deleted: true };
  },
};
