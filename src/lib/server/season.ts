import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import * as t from './db/schema';
import type { RaceResult, RaceTip, SeasonGame, SeasonTip, SprintResult, SprintTip } from '$lib/scoring';
import type { SeasonData } from '$lib/types';

/**
 * Loads one season with all tips and results.
 * Tips/results are mapped exactly like the legacy app mapped its rows (nulls kept, missing
 * DNF/DNS/top-10 lists become undefined), so scoring sees the same values as before.
 */
export async function loadSeason(db: Db, year: number): Promise<SeasonData> {
  const [seasonRow] = await db.select().from(t.seasons).where(eq(t.seasons.year, year));
  if (!seasonRow) throw new Error(`Season ${year} not found`);

  const [teams, drivers, races, players, rt, st, se, rr, sr] = await Promise.all([
    db.select().from(t.teams).where(eq(t.teams.season, year)),
    db.select().from(t.drivers).where(eq(t.drivers.season, year)).orderBy(asc(t.drivers.sortOrder)),
    db.select().from(t.races).where(eq(t.races.season, year)).orderBy(asc(t.races.round)),
    db.select({ id: t.players.id, name: t.players.name, emoji: t.players.emoji, color: t.players.color }).from(t.players).orderBy(asc(t.players.sortOrder), asc(t.players.id)),
    db.select().from(t.raceTips).where(eq(t.raceTips.season, year)),
    db.select().from(t.sprintTips).where(eq(t.sprintTips.season, year)),
    db.select().from(t.seasonTips).where(eq(t.seasonTips.season, year)),
    db.select().from(t.raceResults).where(eq(t.raceResults.season, year)),
    db.select().from(t.sprintResults).where(eq(t.sprintResults.season, year)),
  ]);

  const raceTips: SeasonGame['raceTips'] = {};
  for (const r of rt) {
    const tip: RaceTip = {
      winner: r.winner, podium: [r.podiumP1, r.podiumP2, r.podiumP3], pole: r.pole, fastestLap: r.fastestLap,
      bestConstructor: r.bestConstructor, dnf: r.dnf, dns: r.dns, submittedAt: r.submittedAt,
    };
    (raceTips[r.round] ??= {})[r.playerId] = tip;
  }
  const sprintTips: SeasonGame['sprintTips'] = {};
  for (const r of st) {
    const tip: SprintTip = { winner: r.winner, podium: [r.podiumP1, r.podiumP2, r.podiumP3], submittedAt: r.submittedAt };
    (sprintTips[r.round] ??= {})[r.playerId] = tip;
  }
  const seasonTips: Record<string, SeasonTip> = {};
  for (const r of se) seasonTips[r.playerId] = { wdc: r.wdc, wcc: r.wcc, submittedAt: r.submittedAt };
  const raceResults: Record<number, RaceResult & { topTen?: string[]; enteredAt?: string | null }> = {};
  for (const r of rr) {
    raceResults[r.round] = {
      winner: r.winner, podium: [r.podiumP1, r.podiumP2, r.podiumP3], pole: r.pole, fastestLap: r.fastestLap,
      bestConstructor: r.bestConstructor, topTen: r.topTen || undefined, dnf: r.dnf || undefined, dns: r.dns || undefined, enteredAt: r.enteredAt,
    };
  }
  const sprintResults: Record<number, SprintResult> = {};
  for (const r of sr) sprintResults[r.round] = { winner: r.winner, podium: [r.podiumP1, r.podiumP2, r.podiumP3] };

  return {
    year,
    teams: teams.map(x => ({ id: x.id, name: x.name, color: x.color })),
    drivers: drivers.map(d => ({ id: d.id, name: d.name, number: d.number, teamId: d.teamId })),
    races: races.map(r => ({
      round: r.round, name: r.name, country: r.country, countryCode: r.countryCode, circuit: r.circuit, city: r.city, date: r.date,
      qualiStartUTC: r.qualiStart, sprintStartUTC: r.sprintStart, raceStartUTC: r.raceStart, sprint: r.sprint,
    })),
    players,
    game: {
      // Same order as legacy season.json: a full tie keeps this order, as before.
      players: players.map(p => ({ id: p.id })),
      races: races.map(r => ({ round: r.round, sprint: r.sprint, raceStartUTC: r.raceStart, sprintStartUTC: r.sprintStart })),
      raceTips, sprintTips, seasonTips, raceResults, sprintResults,
      final: seasonRow.wdc && seasonRow.wcc ? { wdc: seasonRow.wdc, wcc: seasonRow.wcc } : null,
    },
  };
}
