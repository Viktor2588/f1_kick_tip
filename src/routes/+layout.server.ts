import type { LayoutServerLoad } from './$types';
import { season } from '$lib/domain/season';
import { calculateStandings } from '$lib/domain/scoring';
import { redact } from '$lib/domain/schedule';
import { getStore, isFileMode, now } from '$lib/server/config';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  depends('app:game');
  const t = now();
  const full = await getStore().load();
  // Standings come from the full data; only the redacted view leaves the server.
  const standings = calculateStandings(season, full);
  return {
    now: t.toISOString(),
    viewer: locals.playerId,
    isAdmin: locals.isAdmin,
    devMode: isFileMode(),
    game: redact(season, full, locals.playerId, t),
    standings,
  };
};
