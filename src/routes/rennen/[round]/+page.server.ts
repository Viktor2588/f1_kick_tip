import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSeasonData } from '$lib/server/data';
import { raceView } from '$lib/server/views';
import { formString, saveRaceTip, saveSprintTip } from '$lib/server/tips';

function roundParam(raw: string) {
  const round = Number(raw);
  if (!Number.isInteger(round)) error(404, 'Rennen nicht gefunden');
  return round;
}

export async function load({ params, locals }) {
  const view = raceView(await getSeasonData(), roundParam(params.round), new Date(), locals.player?.id ?? null);
  if (!view) error(404, 'Rennen nicht gefunden');
  return { view };
}

export const actions = {
  race: async ({ params, locals, request }) => {
    if (!locals.player) return fail(401, { form: 'race', message: 'Bitte zuerst mit deinem persönlichen Link anmelden.' });
    const form = await request.formData();
    const input = {
      winner: formString(form, 'winner'), p2: formString(form, 'p2'), p3: formString(form, 'p3'),
      pole: formString(form, 'pole'), fastestLap: formString(form, 'fastestLap'), bestConstructor: formString(form, 'bestConstructor'),
      dnf: formString(form, 'dnf'), dns: formString(form, 'dns'),
    };
    const res = await saveRaceTip(await getDb(), await getSeasonData(), locals.player.id, roundParam(params.round), input);
    if (!res.ok) return fail(res.status, { form: 'race', message: res.message });
    return { form: 'race', saved: true };
  },

  sprint: async ({ params, locals, request }) => {
    if (!locals.player) return fail(401, { form: 'sprint', message: 'Bitte zuerst mit deinem persönlichen Link anmelden.' });
    const form = await request.formData();
    const input = { winner: formString(form, 'winner'), p2: formString(form, 'p2'), p3: formString(form, 'p3') };
    const res = await saveSprintTip(await getDb(), await getSeasonData(), locals.player.id, roundParam(params.round), input);
    if (!res.ok) return fail(res.status, { form: 'sprint', message: res.message });
    return { form: 'sprint', saved: true };
  },
};
