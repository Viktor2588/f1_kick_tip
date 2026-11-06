// Entering results (admin) and the season's final champions.
import { and, eq } from 'drizzle-orm';
import { raceResults, seasons, seasonTips, sprintResults } from './db/schema';
import type { Db } from './db';
import type { SeasonData } from '$lib/types';
import type { SaveResult } from './tips';

/** DNF/DNS tips exist from this round on. Earlier results keep "no lists", so their max stays 21 as before. */
export const DNF_FROM_ROUND = 16;

export interface RaceResultInput { winner: string; p2: string; p3: string; pole: string; fastestLap: string; bestConstructor: string; dnf: string[]; dns: string[] }
export interface SprintResultInput { winner: string; p2: string; p3: string }

function knownDrivers(data: SeasonData) { return new Set(data.drivers.map(d => d.id)); }

export function validateRaceResult(data: SeasonData, round: number, r: RaceResultInput): string | null {
  if (!data.races.some(x => x.round === round)) return 'Rennen nicht gefunden.';
  const drivers = knownDrivers(data);
  if (!r.winner || !r.p2 || !r.p3 || !r.pole || !r.fastestLap || !r.bestConstructor) return 'Bitte Podium, Pole, schnellste Runde und Konstrukteur eintragen.';
  if (![r.winner, r.p2, r.p3, r.pole, r.fastestLap, ...r.dnf, ...r.dns].every(id => drivers.has(id))) return 'Unbekannter Fahrer.';
  if (!data.teams.some(t => t.id === r.bestConstructor)) return 'Unbekanntes Team.';
  if (new Set([r.winner, r.p2, r.p3]).size !== 3) return 'Jeder Fahrer nur einmal auf dem Podium.';
  if (r.dnf.some(id => r.dns.includes(id))) return 'Ein Fahrer kann nicht DNF und DNS zugleich sein.';
  if ([r.winner, r.p2, r.p3].some(id => r.dnf.includes(id) || r.dns.includes(id))) return 'Ein Podiumsfahrer kann nicht ausgefallen sein.';
  return null;
}

export async function saveRaceResult(db: Db, data: SeasonData, round: number, r: RaceResultInput, now = new Date()): Promise<SaveResult> {
  // A result reveals all tips of the round and closes tipping, so it can only exist once the race has started.
  const race = data.races.find(x => x.round === round);
  if (race && now < new Date(race.raceStartUTC)) return { ok: false, status: 403, message: 'Das Rennen hat noch nicht begonnen.' };
  const error = validateRaceResult(data, round, r);
  if (error) return { ok: false, status: 400, message: error };
  const withLists = round >= DNF_FROM_ROUND;
  const row = {
    season: data.year, round, winner: r.winner, podiumP1: r.winner, podiumP2: r.p2, podiumP3: r.p3,
    pole: r.pole, fastestLap: r.fastestLap, bestConstructor: r.bestConstructor,
    topTen: null, dnf: withLists ? [...new Set(r.dnf)] : null, dns: withLists ? [...new Set(r.dns)] : null,
    enteredAt: now.toISOString(),
  };
  await db.insert(raceResults).values(row).onConflictDoUpdate({ target: [raceResults.season, raceResults.round], set: { ...row } });
  return { ok: true };
}

export async function saveSprintResult(db: Db, data: SeasonData, round: number, r: SprintResultInput, now = new Date()): Promise<SaveResult> {
  const race = data.races.find(x => x.round === round);
  if (!race) return { ok: false, status: 404, message: 'Rennen nicht gefunden.' };
  if (!race.sprint || !race.sprintStartUTC) return { ok: false, status: 400, message: 'Kein Sprint an diesem Wochenende.' };
  if (now < new Date(race.sprintStartUTC)) return { ok: false, status: 403, message: 'Der Sprint hat noch nicht begonnen.' };
  const drivers = knownDrivers(data);
  if (!r.winner || !r.p2 || !r.p3) return { ok: false, status: 400, message: 'Bitte P1, P2 und P3 eintragen.' };
  if (![r.winner, r.p2, r.p3].every(id => drivers.has(id))) return { ok: false, status: 400, message: 'Unbekannter Fahrer.' };
  if (new Set([r.winner, r.p2, r.p3]).size !== 3) return { ok: false, status: 400, message: 'Jeder Fahrer nur einmal auf dem Podium.' };
  const row = { season: data.year, round, winner: r.winner, podiumP1: r.winner, podiumP2: r.p2, podiumP3: r.p3, enteredAt: now.toISOString() };
  await db.insert(sprintResults).values(row).onConflictDoUpdate({ target: [sprintResults.season, sprintResults.round], set: { ...row } });
  return { ok: true };
}

export async function deleteRaceResult(db: Db, year: number, round: number) {
  await db.delete(raceResults).where(and(eq(raceResults.season, year), eq(raceResults.round, round)));
}
export async function deleteSprintResult(db: Db, year: number, round: number) {
  await db.delete(sprintResults).where(and(eq(sprintResults.season, year), eq(sprintResults.round, round)));
}

/** Season end: set (or clear with empty strings) the champions. */
export async function saveChampions(db: Db, data: SeasonData, wdc: string, wcc: string): Promise<SaveResult> {
  if ((wdc && !data.drivers.some(d => d.id === wdc)) || (wcc && !data.teams.some(t => t.id === wcc))) return { ok: false, status: 400, message: 'Unbekannter Fahrer oder Team.' };
  if (!!wdc !== !!wcc) return { ok: false, status: 400, message: 'Bitte Weltmeister und Konstrukteurs-Weltmeister zusammen eintragen.' };
  await db.update(seasons).set({ wdc: wdc || null, wcc: wcc || null }).where(eq(seasons.year, data.year));
  return { ok: true };
}

/** Season tips (WDC/WCC), allowed until the start of round 1. */
export async function saveSeasonTip(db: Db, data: SeasonData, playerId: string, wdc: string, wcc: string, now = new Date()): Promise<SaveResult> {
  const first = data.races.find(r => r.round === 1);
  if (first && now >= new Date(first.raceStartUTC)) return { ok: false, status: 403, message: 'Saison-Tipps sind seit dem Start von Runde 1 geschlossen.' };
  if (!data.drivers.some(d => d.id === wdc) || !data.teams.some(t => t.id === wcc)) return { ok: false, status: 400, message: 'Bitte Weltmeister und Konstrukteurs-Weltmeister wählen.' };
  const row = { season: data.year, playerId, wdc, wcc, submittedAt: now.toISOString() };
  await db.insert(seasonTips).values(row).onConflictDoUpdate({ target: [seasonTips.season, seasonTips.playerId], set: { ...row } });
  return { ok: true };
}
