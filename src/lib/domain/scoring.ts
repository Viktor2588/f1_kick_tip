// Scoring engine. Behaviour is identical to the legacy js/scoring.js (verified by
// scoring.parity.test.ts), plus season tips are now actually scored once `season.final` is set.

import type {
  GameData, PlayerId, Podium, Race, RaceResult, RaceTip, Season, SeasonTip, SprintResult, SprintTip,
} from './types';

export const POINTS = {
  race: { winner: 3, p2: 2, p3: 2, podiumBonus: 1, pole: 3, fastestLap: 3, bestConstructor: 3, perfect: 5, dnf: 3, dns: 5 },
  sprint: { winner: 3, p2: 1, p3: 1, podiumBonus: 1, perfect: 2 },
  season: { wdc: 20, wcc: 15 },
} as const;

export const RACE_BASE_MAX = 21;
export const RACE_DNF_DNS_MAX = 8;
export const SPRINT_MAX = 7;

export interface RaceBreakdown {
  winner: number; podiumP2: number; podiumP3: number; podiumBonus: number;
  pole: number; fastestLap: number; bestConstructor: number; perfectRound: number;
  dnf: number; dns: number;
}

export interface SprintBreakdown {
  sprintWinner: number; sprintP2: number; sprintP3: number; sprintPodiumBonus: number; perfectSprint: number;
}

export interface Score<B> {
  total: number;
  breakdown: B;
  isPerfect: boolean;
  late: boolean;
  max: number;
}

export function isLate(submittedAt: string | null | undefined, deadlineUTC: string | null | undefined): boolean {
  if (!submittedAt || !deadlineUTC) return false;
  return new Date(submittedAt).getTime() > new Date(deadlineUTC).getTime();
}

const sum = (o: object) => Object.values(o).reduce((a: number, v) => a + (v as number), 0);

/**
 * Per position: 'exact' | 'bonus' (on podium, other position) | 'miss'.
 * Shared by race and sprint; exact means same driver at the same index.
 */
export function podiumHits(tip: Podium, result: Podium): Array<'exact' | 'bonus' | 'miss' | 'empty'> {
  return [0, 1, 2].map((i) => {
    const d = tip[i];
    if (!d) return 'empty';
    if (d === result[i]) return 'exact';
    return result.includes(d) ? 'bonus' : 'miss';
  });
}

export function raceMax(result: RaceResult | null | undefined): number {
  return RACE_BASE_MAX + (Array.isArray(result?.dnf) ? RACE_DNF_DNS_MAX : 0);
}

export function scoreRace(tip: RaceTip | null | undefined, result: RaceResult | null | undefined, race: Race): Score<RaceBreakdown> {
  const breakdown: RaceBreakdown = {
    winner: 0, podiumP2: 0, podiumP3: 0, podiumBonus: 0, pole: 0,
    fastestLap: 0, bestConstructor: 0, perfectRound: 0, dnf: 0, dns: 0,
  };
  const max = raceMax(result);
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false, late: false, max };
  if (isLate(tip.submittedAt, race.raceStartUTC)) return { total: 0, breakdown, isPerfect: false, late: true, max };

  const P = POINTS.race;
  const hits = podiumHits(tip.podium, result.podium);
  if (hits[0] === 'exact') breakdown.winner = P.winner;
  if (hits[1] === 'exact') breakdown.podiumP2 = P.p2;
  if (hits[2] === 'exact') breakdown.podiumP3 = P.p3;
  breakdown.podiumBonus = hits.filter((h) => h === 'bonus').length * P.podiumBonus;

  // A blank pick never matches (legacy scored blank === blank as a hit).
  const hit = (a: string | null, b: string | null) => !!a && a === b;
  if (hit(tip.pole, result.pole)) breakdown.pole = P.pole;
  if (hit(tip.fastestLap, result.fastestLap)) breakdown.fastestLap = P.fastestLap;
  if (hit(tip.bestConstructor, result.bestConstructor)) breakdown.bestConstructor = P.bestConstructor;

  // Perfect round: every base category right. DNF/DNS don't count towards it.
  const isPerfect = hits.every((h) => h === 'exact') && !!breakdown.pole && !!breakdown.fastestLap && !!breakdown.bestConstructor;
  if (isPerfect) breakdown.perfectRound = P.perfect;

  if (tip.dnf && result.dnf?.includes(tip.dnf)) breakdown.dnf = P.dnf;
  if (tip.dns && result.dns?.includes(tip.dns)) breakdown.dns = P.dns;

  return { total: sum(breakdown), breakdown, isPerfect, late: false, max };
}

export function scoreSprint(tip: SprintTip | null | undefined, result: SprintResult | null | undefined, race: Race): Score<SprintBreakdown> {
  const breakdown: SprintBreakdown = { sprintWinner: 0, sprintP2: 0, sprintP3: 0, sprintPodiumBonus: 0, perfectSprint: 0 };
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false, late: false, max: SPRINT_MAX };
  if (isLate(tip.submittedAt, race.sprintStartUTC)) return { total: 0, breakdown, isPerfect: false, late: true, max: SPRINT_MAX };

  const P = POINTS.sprint;
  const hits = podiumHits(tip.podium, result.podium);
  if (hits[0] === 'exact') breakdown.sprintWinner = P.winner;
  if (hits[1] === 'exact') breakdown.sprintP2 = P.p2;
  if (hits[2] === 'exact') breakdown.sprintP3 = P.p3;
  breakdown.sprintPodiumBonus = hits.filter((h) => h === 'bonus').length * P.podiumBonus;
  const isPerfect = hits.every((h) => h === 'exact');
  if (isPerfect) breakdown.perfectSprint = P.perfect;
  return { total: sum(breakdown), breakdown, isPerfect, late: false, max: SPRINT_MAX };
}

export function scoreSeason(tip: SeasonTip | null | undefined, final: Season['final']) {
  const breakdown = { wdc: 0, wcc: 0 };
  if (tip && final) {
    if (tip.wdc === final.wdc) breakdown.wdc = POINTS.season.wdc;
    if (tip.wcc === final.wcc) breakdown.wcc = POINTS.season.wcc;
  }
  return { total: breakdown.wdc + breakdown.wcc, breakdown };
}

export interface Standing {
  playerId: PlayerId;
  rank: number;
  totalPoints: number;
  racePoints: number;
  sprintPoints: number;
  seasonPoints: number;
  correctWinners: number;
  perfectRounds: number;
  correctPoles: number;
  /** Earned / possible over scored rounds, 0–100. */
  accuracy: number;
  raceScores: Record<number, Score<RaceBreakdown>>;
  sprintScores: Record<number, Score<SprintBreakdown>>;
}

/** Standings with legacy tiebreakers: points > correct winners > perfect rounds > correct poles. */
export function calculateStandings(season: Season, data: Pick<GameData, 'raceTips' | 'sprintTips' | 'seasonTips' | 'raceResults' | 'sprintResults'>): Standing[] {
  const rows: Standing[] = season.players.map((player) => {
    const pid = player.id;
    const row: Standing = {
      playerId: pid, rank: 0, totalPoints: 0, racePoints: 0, sprintPoints: 0, seasonPoints: 0,
      correctWinners: 0, perfectRounds: 0, correctPoles: 0, accuracy: 0, raceScores: {}, sprintScores: {},
    };
    let earned = 0;
    let possible = 0;
    for (const race of season.races) {
      const key = String(race.round);
      const result = data.raceResults[key];
      const tip = data.raceTips[key]?.[pid];
      if (result && tip) {
        const s = scoreRace(tip, result, race);
        row.raceScores[race.round] = s;
        row.racePoints += s.total;
        if (s.breakdown.winner) row.correctWinners++;
        if (s.isPerfect) row.perfectRounds++;
        if (s.breakdown.pole) row.correctPoles++;
        earned += s.total;
        possible += s.max;
      }
      if (race.sprint) {
        const sres = data.sprintResults[key];
        const stip = data.sprintTips[key]?.[pid];
        if (sres && stip) {
          const s = scoreSprint(stip, sres, race);
          row.sprintScores[race.round] = s;
          row.sprintPoints += s.total;
          earned += s.total;
          possible += s.max;
        }
      }
    }
    row.seasonPoints = scoreSeason(data.seasonTips[pid], season.final).total;
    row.totalPoints = row.racePoints + row.sprintPoints + row.seasonPoints;
    row.accuracy = possible ? Math.round((earned / possible) * 100) : 0;
    return row;
  });

  const cmp = (a: Standing, b: Standing) =>
    b.totalPoints - a.totalPoints ||
    b.correctWinners - a.correctWinners ||
    b.perfectRounds - a.perfectRounds ||
    b.correctPoles - a.correctPoles;
  rows.sort(cmp);
  // Shared rank on a full tie (all tiebreakers equal).
  rows.forEach((r, i) => { r.rank = i > 0 && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
  return rows;
}

/**
 * Cumulative points per player after each scored round (race + sprint of that weekend),
 * for the season chart. Rounds without any result are skipped.
 */
export function pointsProgression(season: Season, standings: Standing[], data: Pick<GameData, 'raceResults' | 'sprintResults'>) {
  const rounds = season.races
    .filter((r) => data.raceResults[String(r.round)] || data.sprintResults[String(r.round)])
    .map((r) => r.round);
  const series = standings.map((s) => {
    let acc = 0;
    return {
      playerId: s.playerId,
      points: rounds.map((round) => {
        acc += (s.raceScores[round]?.total ?? 0) + (s.sprintScores[round]?.total ?? 0);
        return acc;
      }),
    };
  });
  return { rounds, series };
}
