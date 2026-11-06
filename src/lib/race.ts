import type { Race } from './types';

export type DeadlineStatus = 'open' | 'locked' | 'finished';

export function deadlineStatus(race: Race, hasResult: boolean, now = new Date()): DeadlineStatus {
  if (hasResult) return 'finished';
  return now < new Date(race.raceStartUTC) ? 'open' : 'locked';
}

export function sprintDeadlineStatus(race: Race, hasResult: boolean, now = new Date()): DeadlineStatus | null {
  if (!race.sprint || !race.sprintStartUTC) return null;
  if (hasResult) return 'finished';
  return now < new Date(race.sprintStartUTC) ? 'open' : 'locked';
}

/** First race without a result that has not started yet (same rule as before). */
export function nextRace(races: Race[], resultRounds: Set<number>, now = new Date()): Race | null {
  return races.find(r => !resultRounds.has(r.round) && new Date(r.raceStartUTC) > now) ?? null;
}

export function countdownParts(targetUTC: string, now = Date.now()) {
  const diff = new Date(targetUTC).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    expired: false,
  };
}

export function flag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏁';
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const TZ = 'Europe/Berlin';
export const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', timeZone: TZ });
export const fmtDateShort = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: TZ });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ });
