import type { RaceResult, RaceTip, Race, SprintResult, SprintTip, SeasonTip, Season } from './types';
import { RACE_POINTS, SPRINT_POINTS, SEASON_POINTS, RACE_MAX_BASE, RACE_MAX_DNF, SPRINT_MAX } from './rules';

export interface RaceBreakdown {
  p1: number;
  p2: number;
  p3: number;
  podiumBonus: number;
  pole: number;
  fastestLap: number;
  bestConstructor: number;
  perfect: number;
  dnf: number;
  dns: number;
}

export interface Score<B> {
  total: number;
  max: number;
  breakdown: B;
  perfect: boolean;
  late: boolean;
}

export interface SprintBreakdown {
  p1: number;
  p2: number;
  p3: number;
  podiumBonus: number;
  perfect: number;
}

export const isLate = (submittedAt: string | undefined, deadline: string | null | undefined): boolean =>
  !!submittedAt && !!deadline && new Date(submittedAt).getTime() > new Date(deadline).getTime();

const sum = (o: object) => Object.values(o).reduce((a: number, b: number) => a + b, 0);

/** Points for a driver tipped on the podium but on a different podium position. */
function podiumBonus(tipped: (string | undefined)[], actual: string[], exact: boolean[], perHit: number): number {
  let bonus = 0;
  tipped.forEach((driver, i) => {
    if (driver && !exact[i] && actual.includes(driver)) bonus += perHit;
  });
  return bonus;
}

export function raceMax(result: RaceResult | null | undefined): number {
  return RACE_MAX_BASE + (Array.isArray(result?.dnf) ? RACE_MAX_DNF : 0);
}

export function scoreRace(tip: RaceTip | null | undefined, result: RaceResult | null | undefined, race: Pick<Race, 'raceStartUTC'>): Score<RaceBreakdown> {
  const breakdown: RaceBreakdown = { p1: 0, p2: 0, p3: 0, podiumBonus: 0, pole: 0, fastestLap: 0, bestConstructor: 0, perfect: 0, dnf: 0, dns: 0 };
  const max = raceMax(result);
  if (!tip || !result) return { total: 0, max, breakdown, perfect: false, late: false };
  if (isLate(tip.submittedAt, race.raceStartUTC)) return { total: 0, max, breakdown, perfect: false, late: true };

  const tipped = [tip.p1, tip.p2, tip.p3];
  const actual = [result.p1, result.p2, result.p3];
  const exact = tipped.map((d, i) => !!d && d === actual[i]);

  if (exact[0]) breakdown.p1 = RACE_POINTS.p1;
  if (exact[1]) breakdown.p2 = RACE_POINTS.p2;
  if (exact[2]) breakdown.p3 = RACE_POINTS.p3;
  breakdown.podiumBonus = podiumBonus(tipped, actual, exact, RACE_POINTS.podiumBonus);
  if (tip.pole && tip.pole === result.pole) breakdown.pole = RACE_POINTS.pole;
  if (tip.fastestLap && tip.fastestLap === result.fastestLap) breakdown.fastestLap = RACE_POINTS.fastestLap;
  if (tip.bestConstructor && tip.bestConstructor === result.bestConstructor) breakdown.bestConstructor = RACE_POINTS.bestConstructor;

  // DNF/DNS never count towards the perfect round.
  const perfect = exact.every(Boolean) && breakdown.pole > 0 && breakdown.fastestLap > 0 && breakdown.bestConstructor > 0;
  if (perfect) breakdown.perfect = RACE_POINTS.perfect;

  if (tip.dnf && result.dnf?.includes(tip.dnf)) breakdown.dnf = RACE_POINTS.dnf;
  if (tip.dns && result.dns?.includes(tip.dns)) breakdown.dns = RACE_POINTS.dns;

  return { total: sum(breakdown), max, breakdown, perfect, late: false };
}

export function scoreSprint(tip: SprintTip | null | undefined, result: SprintResult | null | undefined, race: Pick<Race, 'sprintStartUTC'>): Score<SprintBreakdown> {
  const breakdown: SprintBreakdown = { p1: 0, p2: 0, p3: 0, podiumBonus: 0, perfect: 0 };
  if (!tip || !result) return { total: 0, max: SPRINT_MAX, breakdown, perfect: false, late: false };
  if (isLate(tip.submittedAt, race.sprintStartUTC)) return { total: 0, max: SPRINT_MAX, breakdown, perfect: false, late: true };

  const tipped = [tip.p1, tip.p2, tip.p3];
  const actual = [result.p1, result.p2, result.p3];
  const exact = tipped.map((d, i) => !!d && d === actual[i]);

  if (exact[0]) breakdown.p1 = SPRINT_POINTS.p1;
  if (exact[1]) breakdown.p2 = SPRINT_POINTS.p2;
  if (exact[2]) breakdown.p3 = SPRINT_POINTS.p3;
  breakdown.podiumBonus = podiumBonus(tipped, actual, exact, SPRINT_POINTS.podiumBonus);
  const perfect = exact.every(Boolean);
  if (perfect) breakdown.perfect = SPRINT_POINTS.perfect;

  return { total: sum(breakdown), max: SPRINT_MAX, breakdown, perfect, late: false };
}

export function scoreSeason(tip: SeasonTip | null | undefined, final: Season['final']): { total: number; wdc: number; wcc: number } {
  if (!tip || !final) return { total: 0, wdc: 0, wcc: 0 };
  const wdc = final.wdc && tip.wdc === final.wdc ? SEASON_POINTS.wdc : 0;
  const wcc = final.wcc && tip.wcc === final.wcc ? SEASON_POINTS.wcc : 0;
  return { total: wdc + wcc, wdc, wcc };
}
