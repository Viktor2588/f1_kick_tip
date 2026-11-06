// Saving tips. The server decides whether a tip is still allowed (deadline) and stamps the time itself;
// the browser cannot backdate a tip or tip for someone else.
import { raceTips, sprintTips } from './db/schema';
import type { Db } from './db';
import type { SeasonData } from '$lib/types';

export interface RaceTipInput { winner: string; p2: string; p3: string; pole: string; fastestLap: string; bestConstructor: string; dnf: string; dns: string }
export interface SprintTipInput { winner: string; p2: string; p3: string }

export type SaveResult = { ok: true } | { ok: false; status: 400 | 403 | 404; message: string };

function check(data: SeasonData, round: number) {
  return data.races.find(r => r.round === round) ?? null;
}

export function validateRaceTip(data: SeasonData, input: RaceTipInput): string | null {
  const drivers = new Set(data.drivers.map(d => d.id));
  const teams = new Set(data.teams.map(t => t.id));
  if (!input.winner || !input.p2 || !input.p3) return 'Bitte P1, P2 und P3 wählen.';
  for (const id of [input.winner, input.p2, input.p3, input.pole, input.fastestLap, input.dnf, input.dns]) {
    if (id && !drivers.has(id)) return 'Unbekannter Fahrer.';
  }
  if (input.bestConstructor && !teams.has(input.bestConstructor)) return 'Unbekanntes Team.';
  if (new Set([input.winner, input.p2, input.p3]).size !== 3) return 'Jeder Fahrer darf nur einmal auf dem Podium stehen.';
  if (input.dnf && input.dnf === input.dns) return 'Ein Fahrer kann nicht DNF und DNS zugleich sein.';
  return null;
}

export async function saveRaceTip(db: Db, data: SeasonData, playerId: string, round: number, input: RaceTipInput, now = new Date()): Promise<SaveResult> {
  const race = check(data, round);
  if (!race) return { ok: false, status: 404, message: 'Rennen nicht gefunden.' };
  if (data.game.raceResults[round]) return { ok: false, status: 403, message: 'Dieses Rennen ist bereits gewertet.' };
  if (now >= new Date(race.raceStartUTC)) return { ok: false, status: 403, message: 'Tipp-Schluss ist vorbei: das Rennen hat begonnen.' };
  const error = validateRaceTip(data, input);
  if (error) return { ok: false, status: 400, message: error };

  const row = {
    season: data.year, round, playerId,
    winner: input.winner, podiumP1: input.winner, podiumP2: input.p2, podiumP3: input.p3,
    // Same storage as the legacy app: optional categories are stored as '' when left empty.
    pole: input.pole, fastestLap: input.fastestLap, bestConstructor: input.bestConstructor, dnf: input.dnf, dns: input.dns,
    submittedAt: now.toISOString(),
  };
  await db.insert(raceTips).values(row).onConflictDoUpdate({
    target: [raceTips.season, raceTips.round, raceTips.playerId],
    set: { ...row },
  });
  return { ok: true };
}

export async function saveSprintTip(db: Db, data: SeasonData, playerId: string, round: number, input: SprintTipInput, now = new Date()): Promise<SaveResult> {
  const race = check(data, round);
  if (!race) return { ok: false, status: 404, message: 'Rennen nicht gefunden.' };
  if (!race.sprint || !race.sprintStartUTC) return { ok: false, status: 400, message: 'An diesem Wochenende gibt es keinen Sprint.' };
  if (data.game.sprintResults[round]) return { ok: false, status: 403, message: 'Dieser Sprint ist bereits gewertet.' };
  if (now >= new Date(race.sprintStartUTC)) return { ok: false, status: 403, message: 'Tipp-Schluss ist vorbei: der Sprint hat begonnen.' };
  const drivers = new Set(data.drivers.map(d => d.id));
  if (!input.winner || !input.p2 || !input.p3) return { ok: false, status: 400, message: 'Bitte P1, P2 und P3 wählen.' };
  if (![input.winner, input.p2, input.p3].every(id => drivers.has(id))) return { ok: false, status: 400, message: 'Unbekannter Fahrer.' };
  if (new Set([input.winner, input.p2, input.p3]).size !== 3) return { ok: false, status: 400, message: 'Jeder Fahrer darf nur einmal auf dem Podium stehen.' };

  const row = { season: data.year, round, playerId, winner: input.winner, podiumP1: input.winner, podiumP2: input.p2, podiumP3: input.p3, submittedAt: now.toISOString() };
  await db.insert(sprintTips).values(row).onConflictDoUpdate({ target: [sprintTips.season, sprintTips.round, sprintTips.playerId], set: { ...row } });
  return { ok: true };
}

export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}
