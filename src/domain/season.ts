// Time-dependent questions about the calendar: what's next, what's open, what's revealed.
import type { Race, Season, Snapshot } from './types';

export type TipPhase = 'open' | 'locked' | 'scored';

const t = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

export const raceDeadline = (race: Race) => race.raceStartUTC;
export const sprintDeadline = (race: Race) => race.sprintStartUTC;
export const seasonDeadline = (season: Season) => season.races[0]?.raceStartUTC ?? null;

export function racePhase(race: Race, snap: Snapshot, now: number): TipPhase {
  if (snap.raceResults[race.round]) return 'scored';
  return now < t(race.raceStartUTC) ? 'open' : 'locked';
}

export function sprintPhase(race: Race, snap: Snapshot, now: number): TipPhase | null {
  if (!race.sprint || !race.sprintStartUTC) return null;
  if (snap.sprintResults[race.round]) return 'scored';
  return now < t(race.sprintStartUTC) ? 'open' : 'locked';
}

export const seasonTipOpen = (season: Season, now: number) => now < t(seasonDeadline(season));

/** Next race whose race-tip deadline is still ahead. */
export function nextRace(season: Season, snap: Snapshot, now: number): Race | null {
  return season.races.find((r) => !snap.raceResults[r.round] && t(r.raceStartUTC) > now) ?? null;
}

/** A race that has started but has no result yet (the "Ergebnis folgt" state). */
export function awaitingResult(season: Season, snap: Snapshot, now: number): Race | null {
  return [...season.races].reverse().find((r) => !snap.raceResults[r.round] && t(r.raceStartUTC) <= now) ?? null;
}

export interface Deadline {
  kind: 'sprint' | 'race' | 'season';
  race: Race | null;
  at: string;
}

/** All upcoming deadlines in time order. */
export function upcomingDeadlines(season: Season, now: number): Deadline[] {
  const list: Deadline[] = [];
  const sd = seasonDeadline(season);
  if (sd && t(sd) > now) list.push({ kind: 'season', race: null, at: sd });
  for (const r of season.races) {
    if (r.sprint && r.sprintStartUTC && t(r.sprintStartUTC) > now) list.push({ kind: 'sprint', race: r, at: r.sprintStartUTC });
    if (t(r.raceStartUTC) > now) list.push({ kind: 'race', race: r, at: r.raceStartUTC });
  }
  return list.sort((a, b) => t(a.at) - t(b.at));
}

export const completedRounds = (season: Season, snap: Snapshot) =>
  season.races.filter((r) => snap.raceResults[r.round]).length;

export function countdownParts(target: string, now: number) {
  const diff = Math.max(0, t(target) - now);
  return {
    expired: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    totalMs: diff,
  };
}
