// Conversion between the legacy JSON/DB shapes (winner + podium, '' for empty) and the domain model.

import type { GameData, Podium, RaceResult, RaceTip, SeasonTip, SprintResult, SprintTip } from '$lib/domain/types';

const n = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : new Date(0).toISOString());
const list = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : null);

/** Legacy stored the winner separately; it always equals P1. Prefer `winner` like the legacy scorer did. */
export function toPodium(winner: unknown, podium: unknown): Podium {
  const p = Array.isArray(podium) ? podium : [];
  return [n(winner) ?? n(p[0]), n(p[1]), n(p[2])];
}

export interface LegacyRaceTip { winner?: string; podium?: string[]; pole?: string; fastestLap?: string; bestConstructor?: string; dnf?: string; dns?: string; submittedAt?: string }
export interface LegacyRaceResult { winner?: string; podium?: string[]; pole?: string; fastestLap?: string; bestConstructor?: string; dnf?: string[] | null; dns?: string[] | null; topTen?: string[] | null; enteredAt?: string }

export const raceTipFromLegacy = (t: LegacyRaceTip): RaceTip => ({
  podium: toPodium(t.winner, t.podium),
  pole: n(t.pole), fastestLap: n(t.fastestLap), bestConstructor: n(t.bestConstructor),
  dnf: n(t.dnf), dns: n(t.dns), submittedAt: iso(t.submittedAt),
});

export const sprintTipFromLegacy = (t: { winner?: string; podium?: string[]; submittedAt?: string }): SprintTip => ({
  podium: toPodium(t.winner, t.podium), submittedAt: iso(t.submittedAt),
});

export const seasonTipFromLegacy = (t: { wdc: string; wcc: string; submittedAt?: string }): SeasonTip => ({
  wdc: t.wdc, wcc: t.wcc, submittedAt: iso(t.submittedAt),
});

export const raceResultFromLegacy = (r: LegacyRaceResult): RaceResult => ({
  podium: toPodium(r.winner, r.podium),
  pole: n(r.pole), fastestLap: n(r.fastestLap), bestConstructor: n(r.bestConstructor),
  dnf: list(r.dnf), dns: list(r.dns), topTen: list(r.topTen), enteredAt: iso(r.enteredAt),
});

export const sprintResultFromLegacy = (r: { winner?: string; podium?: string[]; enteredAt?: string }): SprintResult => ({
  podium: toPodium(r.winner, r.podium), enteredAt: iso(r.enteredAt),
});

/** Legacy JSON files (data/*.json) → GameData. */
export function fromLegacyFiles(files: {
  predictions?: { predictions?: Record<string, Record<string, LegacyRaceTip>> };
  sprintPredictions?: { sprintPredictions?: Record<string, Record<string, { winner?: string; podium?: string[]; submittedAt?: string }>> };
  seasonPredictions?: { seasonPredictions?: Record<string, { wdc: string; wcc: string; submittedAt?: string }> };
  results?: { results?: Record<string, LegacyRaceResult> };
  sprintResults?: { sprintResults?: Record<string, { winner?: string; podium?: string[]; enteredAt?: string }> };
}): GameData {
  const mapRounds = <A, B>(o: Record<string, Record<string, A>> | undefined, f: (a: A) => B) =>
    Object.fromEntries(Object.entries(o ?? {}).map(([r, byP]) => [r, Object.fromEntries(Object.entries(byP).map(([p, v]) => [p, f(v)]))]));
  const mapVals = <A, B>(o: Record<string, A> | undefined, f: (a: A) => B) =>
    Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, f(v)]));
  return {
    raceTips: mapRounds(files.predictions?.predictions, raceTipFromLegacy),
    sprintTips: mapRounds(files.sprintPredictions?.sprintPredictions, sprintTipFromLegacy),
    seasonTips: mapVals(files.seasonPredictions?.seasonPredictions, seasonTipFromLegacy),
    raceResults: mapVals(files.results?.results, raceResultFromLegacy),
    sprintResults: mapVals(files.sprintResults?.sprintResults, sprintResultFromLegacy),
  };
}
