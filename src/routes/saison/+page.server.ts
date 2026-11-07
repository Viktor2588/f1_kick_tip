import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { season } from '$lib/domain/season';
import { deadlineOf, isOpen } from '$lib/domain/schedule';
import { validateSeasonTip } from '$lib/domain/validate';
import { getStore, now } from '$lib/server/config';

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.playerId) return fail(401, { error: 'Bitte zuerst anmelden' });
    const t = now();
    if (!isOpen(deadlineOf(season, 'season'), t)) return fail(409, { error: 'Saison-Tipps sind seit Runde 1 gesperrt' });
    const f = await request.formData();
    const v = validateSeasonTip(season, { wdc: f.get('wdc'), wcc: f.get('wcc') }, t.toISOString());
    if (!v.ok) return fail(400, { error: v.error });
    await getStore().saveSeasonTip(locals.playerId, v.value);
    return { saved: true };
  },
};
