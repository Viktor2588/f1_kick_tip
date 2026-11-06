import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSeasonData } from '$lib/server/data';
import { saveSeasonTip } from '$lib/server/results';
import { formString } from '$lib/server/tips';
import { scoreSeasonTip } from '$lib/scoring';

export async function load({ locals }) {
  const data = await getSeasonData();
  const round1 = data.races.find(r => r.round === 1);
  const deadline = round1?.raceStartUTC ?? null;
  const open = !!deadline && new Date() < new Date(deadline);
  const final = data.game.final ?? null;
  const me = locals.player?.id ?? null;
  return {
    open,
    deadline,
    final,
    mine: me ? data.game.seasonTips[me] ?? null : null,
    tips: data.players.map(p => {
      const tip = data.game.seasonTips[p.id];
      const visible = !open || p.id === me;
      return {
        player: p,
        submitted: !!tip,
        wdc: visible ? tip?.wdc ?? null : null,
        wcc: visible ? tip?.wcc ?? null : null,
        points: tip && final ? scoreSeasonTip(tip, final).total : null,
      };
    }),
  };
}

export const actions = {
  default: async ({ locals, request }) => {
    if (!locals.player) return fail(401, { message: 'Bitte zuerst mit deinem persönlichen Link anmelden.' });
    const form = await request.formData();
    const res = await saveSeasonTip(await getDb(), await getSeasonData(), locals.player.id, formString(form, 'wdc'), formString(form, 'wcc'));
    if (!res.ok) return fail(res.status, { message: res.message });
    return { saved: true };
  },
};
