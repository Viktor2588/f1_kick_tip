// Deadlines, weekend status and visibility of tips. Pure functions; "now" is always passed in.

import type { GameData, PlayerId, PublicGameData, Race, Season, Visible } from './types';

export type TipKind = 'race' | 'sprint' | 'season';

export function deadlineOf(season: Season, kind: TipKind, race?: Race): string | null {
  if (kind === 'season') return season.races[0]?.raceStartUTC ?? null;
  if (!race) return null;
  return kind === 'sprint' ? (race.sprint ? race.sprintStartUTC : null) : race.raceStartUTC;
}

export function isOpen(deadline: string | null, now: Date): boolean {
  return !!deadline && now.getTime() < new Date(deadline).getTime();
}

export type WeekendStatus = 'upcoming' | 'open' | 'live' | 'awaiting' | 'finished';

/**
 * upcoming: a later weekend, tips already possible
 * open:     the next weekend (first one whose race hasn't started)
 * live:     race started less than ~3h ago
 * awaiting: race over, result not entered yet
 * finished: result entered
 */
export function weekendStatus(race: Race, data: Pick<GameData, 'raceResults'>, now: Date, next: Race | null): WeekendStatus {
  if (data.raceResults[String(race.round)]) return 'finished';
  const start = new Date(race.raceStartUTC).getTime();
  if (now.getTime() < start) return next?.round === race.round ? 'open' : 'upcoming';
  if (now.getTime() < start + 3 * 3600_000) return 'live';
  return 'awaiting';
}

/** The next weekend still open for race tips. */
export function nextRace(season: Season, now: Date): Race | null {
  return season.races.find((r) => now.getTime() < new Date(r.raceStartUTC).getTime()) ?? null;
}

/** The most recent weekend whose race has started (finished or not). */
export function lastStartedRace(season: Season, now: Date): Race | null {
  return [...season.races].reverse().find((r) => now.getTime() >= new Date(r.raceStartUTC).getTime()) ?? null;
}

/** Next session that closes a tip deadline: sprint start or race start. */
export function nextDeadline(season: Season, now: Date): { race: Race; kind: 'race' | 'sprint'; at: string } | null {
  const race = nextRace(season, now);
  if (!race) return null;
  if (race.sprint && race.sprintStartUTC && isOpen(race.sprintStartUTC, now)) {
    return { race, kind: 'sprint', at: race.sprintStartUTC };
  }
  return { race, kind: 'race', at: race.raceStartUTC };
}

export function dnfDnsActive(season: Season, round: number): boolean {
  return round >= season.rules.dnfFromRound;
}

/**
 * Redacts other players' tips while their deadline is open, so they never reach the browser.
 * The viewer always sees their own tips.
 */
export function redact(season: Season, data: GameData, viewer: PlayerId | null, now: Date): PublicGameData {
  const hide = <T extends { submittedAt: string }>(tips: Record<PlayerId, T>, open: boolean) => {
    const out: Record<PlayerId, Visible<T>> = {};
    for (const [pid, tip] of Object.entries(tips)) {
      out[pid] = open && pid !== viewer ? { hidden: true, submittedAt: tip.submittedAt } : tip;
    }
    return out;
  };
  const byRound = new Map(season.races.map((r) => [String(r.round), r]));
  const raceTips: PublicGameData['raceTips'] = {};
  for (const [round, tips] of Object.entries(data.raceTips)) {
    const race = byRound.get(round);
    raceTips[round] = hide(tips, !race || isOpen(race.raceStartUTC, now));
  }
  const sprintTips: PublicGameData['sprintTips'] = {};
  for (const [round, tips] of Object.entries(data.sprintTips)) {
    const race = byRound.get(round);
    sprintTips[round] = hide(tips, !race || isOpen(deadlineOf(season, 'sprint', race), now));
  }
  return {
    raceTips,
    sprintTips,
    seasonTips: hide(data.seasonTips, isOpen(deadlineOf(season, 'season'), now)),
    raceResults: data.raceResults,
    sprintResults: data.sprintResults,
  };
}
