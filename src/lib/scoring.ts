// F1 Kick Tip scoring rules.
//
// This is a faithful port of legacy/js/scoring.js. The points must stay identical for the same inputs,
// including the old edge cases (see tests/parity.test.ts, which runs both side by side):
// - the race "winner" tip counts as podium P1 (podium[0] of a race tip is ignored for scoring),
// - an empty P2/P3 tip matches an empty P2/P3 result,
// - a tip without a submit time is never late,
// - DNF/DNS only score when the result has those lists (from round 16 on) and never count towards
//   the perfect round.

export type DriverId = string;
export type TeamId = string;

export interface RaceTip {
  winner?: DriverId | null;
  podium?: (DriverId | null | undefined)[] | null;
  pole?: DriverId | null;
  fastestLap?: DriverId | null;
  bestConstructor?: TeamId | null;
  dnf?: DriverId | null;
  dns?: DriverId | null;
  submittedAt?: string | null;
}

export interface RaceResult {
  winner?: DriverId | null;
  podium?: (DriverId | null | undefined)[] | null;
  pole?: DriverId | null;
  fastestLap?: DriverId | null;
  bestConstructor?: TeamId | null;
  dnf?: DriverId[] | null;
  dns?: DriverId[] | null;
}

export interface SprintTip {
  winner?: DriverId | null;
  podium?: (DriverId | null | undefined)[] | null;
  submittedAt?: string | null;
}

export interface SprintResult {
  winner?: DriverId | null;
  podium?: (DriverId | null | undefined)[] | null;
}

export interface SeasonTip {
  wdc?: DriverId | null;
  wcc?: TeamId | null;
  submittedAt?: string | null;
}

export interface FinalStandings {
  wdc: DriverId;
  wcc: TeamId;
}

export interface RaceTiming {
  raceStartUTC: string;
  sprintStartUTC?: string | null;
}

export interface RaceBreakdown {
  winner: number;
  podiumP2: number;
  podiumP3: number;
  podiumBonus: number;
  pole: number;
  fastestLap: number;
  bestConstructor: number;
  perfectRound: number;
  dnf: number;
  dns: number;
}

export interface SprintBreakdown {
  sprintWinner: number;
  sprintP2: number;
  sprintP3: number;
  sprintPodiumBonus: number;
  perfectSprint: number;
}

export interface RaceScore {
  total: number;
  breakdown: RaceBreakdown;
  isPerfect: boolean;
  late?: true;
  max: number;
}

export interface SprintScore {
  total: number;
  breakdown: SprintBreakdown;
  isPerfect: boolean;
  late?: true;
}

export const POINTS = {
  race: { winner: 3, podiumP2: 2, podiumP3: 2, podiumBonus: 1, pole: 3, fastestLap: 3, bestConstructor: 3, perfectRound: 5, dnf: 3, dns: 5 },
  sprint: { winner: 3, p2: 1, p3: 1, podiumBonus: 1, perfect: 2 },
  season: { wdc: 20, wcc: 15 },
  raceMax: 21,
  raceMaxDnfDns: 8,
  sprintMax: 7,
} as const;

/** A tip is late when it was submitted after the deadline. A missing time or deadline is never late. */
export function isLate(submittedAt: string | null | undefined, deadlineUTC: string | null | undefined): boolean {
  if (!submittedAt || !deadlineUTC) return false;
  return new Date(submittedAt) > new Date(deadlineUTC);
}

function emptyRaceBreakdown(): RaceBreakdown {
  return { winner: 0, podiumP2: 0, podiumP3: 0, podiumBonus: 0, pole: 0, fastestLap: 0, bestConstructor: 0, perfectRound: 0, dnf: 0, dns: 0 };
}

/** Max race points: 21, plus 8 if the result has DNF/DNS lists. */
export function raceMaxPoints(result: RaceResult | null | undefined): number {
  return POINTS.raceMax + (Array.isArray(result?.dnf) ? POINTS.raceMaxDnfDns : 0);
}

export function scoreRace(tip: RaceTip | null | undefined, result: RaceResult | null | undefined, race: RaceTiming): RaceScore {
  const breakdown = emptyRaceBreakdown();
  const max = raceMaxPoints(result);
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false, max };

  if (isLate(tip.submittedAt, race.raceStartUTC)) {
    return { total: 0, breakdown, isPerfect: false, late: true, max };
  }

  const p = POINTS.race;
  if (tip.winner === result.winner) breakdown.winner = p.winner;

  const tipPodium = [tip.winner, tip.podium?.[1], tip.podium?.[2]];
  const resPodium = [result.winner, result.podium?.[1], result.podium?.[2]];

  if (tipPodium[1] === resPodium[1]) breakdown.podiumP2 = p.podiumP2;
  if (tipPodium[2] === resPodium[2]) breakdown.podiumP3 = p.podiumP3;

  const exact = [breakdown.winner > 0, breakdown.podiumP2 > 0, breakdown.podiumP3 > 0];
  for (let i = 0; i < 3; i++) {
    const driver = tipPodium[i];
    if (!driver) continue;
    if (!exact[i] && resPodium.includes(driver)) breakdown.podiumBonus += p.podiumBonus;
  }

  if (tip.pole === result.pole) breakdown.pole = p.pole;
  if (tip.fastestLap === result.fastestLap) breakdown.fastestLap = p.fastestLap;
  if (tip.bestConstructor === result.bestConstructor) breakdown.bestConstructor = p.bestConstructor;

  const isPerfect =
    breakdown.winner === p.winner &&
    breakdown.podiumP2 === p.podiumP2 &&
    breakdown.podiumP3 === p.podiumP3 &&
    breakdown.pole === p.pole &&
    breakdown.fastestLap === p.fastestLap &&
    breakdown.bestConstructor === p.bestConstructor;
  if (isPerfect) breakdown.perfectRound = p.perfectRound;

  if (tip.dnf && result.dnf?.includes(tip.dnf)) breakdown.dnf = p.dnf;
  if (tip.dns && result.dns?.includes(tip.dns)) breakdown.dns = p.dns;

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown, isPerfect, max };
}

export function scoreSprint(tip: SprintTip | null | undefined, result: SprintResult | null | undefined, race: RaceTiming): SprintScore {
  const breakdown: SprintBreakdown = { sprintWinner: 0, sprintP2: 0, sprintP3: 0, sprintPodiumBonus: 0, perfectSprint: 0 };
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false };

  if (isLate(tip.submittedAt, race.sprintStartUTC)) {
    return { total: 0, breakdown, isPerfect: false, late: true };
  }

  const p = POINTS.sprint;
  const tipPodium = tip.podium || [];
  const resPodium = result.podium || [];

  if (tip.winner === result.winner) breakdown.sprintWinner = p.winner;
  if (tipPodium[1] === resPodium[1]) breakdown.sprintP2 = p.p2;
  if (tipPodium[2] === resPodium[2]) breakdown.sprintP3 = p.p3;

  const exact = [breakdown.sprintWinner > 0, breakdown.sprintP2 > 0, breakdown.sprintP3 > 0];
  for (let i = 0; i < 3; i++) {
    const driver = tipPodium[i];
    if (!driver) continue;
    if (!exact[i] && resPodium.includes(driver)) breakdown.sprintPodiumBonus += p.podiumBonus;
  }

  const isPerfect = breakdown.sprintWinner === p.winner && breakdown.sprintP2 === p.p2 && breakdown.sprintP3 === p.p3;
  if (isPerfect) breakdown.perfectSprint = p.perfect;

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown, isPerfect };
}

export function scoreSeasonTip(tip: SeasonTip | null | undefined, final: FinalStandings | null | undefined) {
  const breakdown = { wdc: 0, wcc: 0 };
  if (!tip || !final) return { total: 0, breakdown };
  if (tip.wdc === final.wdc) breakdown.wdc = POINTS.season.wdc;
  if (tip.wcc === final.wcc) breakdown.wcc = POINTS.season.wcc;
  return { total: breakdown.wdc + breakdown.wcc, breakdown };
}

// ---- Standings ----

export interface SeasonRace extends RaceTiming {
  round: number;
  sprint: boolean;
}

/** All tips and results of a season, keyed by round (number) and player id. */
export interface SeasonGame {
  players: { id: string }[];
  races: SeasonRace[];
  raceTips: Record<number, Record<string, RaceTip>>;
  sprintTips: Record<number, Record<string, SprintTip>>;
  seasonTips: Record<string, SeasonTip>;
  raceResults: Record<number, RaceResult>;
  sprintResults: Record<number, SprintResult>;
  final?: FinalStandings | null;
}

export interface Standing {
  playerId: string;
  totalPoints: number;
  racePoints: number;
  sprintPoints: number;
  seasonPoints: number;
  correctWinners: number;
  perfectRounds: number;
  correctPoles: number;
  raceScores: Record<number, RaceScore>;
  sprintScores: Record<number, SprintScore>;
}

/** Sorted by points, then tiebreakers: correct winners, perfect rounds, correct poles. */
export function calculateStandings(game: SeasonGame): Standing[] {
  const standings: Standing[] = game.players.map(({ id }) => {
    let racePoints = 0;
    let sprintPoints = 0;
    let correctWinners = 0;
    let perfectRounds = 0;
    let correctPoles = 0;
    const raceScores: Record<number, RaceScore> = {};
    const sprintScores: Record<number, SprintScore> = {};

    for (const race of game.races) {
      const result = game.raceResults[race.round];
      const tip = game.raceTips[race.round]?.[id];
      if (result && tip) {
        const score = scoreRace(tip, result, race);
        raceScores[race.round] = score;
        racePoints += score.total;
        if (score.breakdown.winner === POINTS.race.winner) correctWinners++;
        if (score.isPerfect) perfectRounds++;
        if (score.breakdown.pole === POINTS.race.pole) correctPoles++;
      }
      if (race.sprint) {
        const sResult = game.sprintResults[race.round];
        const sTip = game.sprintTips[race.round]?.[id];
        if (sResult && sTip) {
          const score = scoreSprint(sTip, sResult, race);
          sprintScores[race.round] = score;
          sprintPoints += score.total;
        }
      }
    }

    const seasonTip = game.seasonTips[id];
    const seasonPoints = seasonTip && game.final ? scoreSeasonTip(seasonTip, game.final).total : 0;

    return {
      playerId: id,
      totalPoints: racePoints + sprintPoints + seasonPoints,
      racePoints,
      sprintPoints,
      seasonPoints,
      correctWinners,
      perfectRounds,
      correctPoles,
      raceScores,
      sprintScores,
    };
  });

  standings.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.correctWinners - a.correctWinners ||
    b.perfectRounds - a.perfectRounds ||
    b.correctPoles - a.correctPoles,
  );
  return standings;
}

/** Share of possible points earned in scored races and sprints, in percent (rounded). */
export function calculateAccuracy(raceScores: Record<number, RaceScore>, sprintScores: Record<number, SprintScore>): number {
  const sprints = Object.values(sprintScores);
  const races = Object.values(raceScores);
  const maxTotal = races.reduce((s, r) => s + r.max, 0) + sprints.length * POINTS.sprintMax;
  if (maxTotal === 0) return 0;
  const earned = races.reduce((s, r) => s + r.total, 0) + sprints.reduce((s, r) => s + r.total, 0);
  return Math.round((earned / maxTotal) * 100);
}
