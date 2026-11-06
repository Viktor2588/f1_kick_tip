// Converts the legacy app's data shape (the JSON files and what legacy fetchAllData() returned)
// into the rebuild's SeasonGame shape. Used by the import and the parity tests.
import type { RaceResult, RaceTip, SeasonGame, SeasonRace, SeasonTip, SprintResult, SprintTip } from './scoring';

export interface LegacySeasonFile {
  season: number;
  players: { id: string; name: string; emoji: string; color: string }[];
  teams: { id: string; name: string; color: string; drivers: string[] }[];
  drivers: { id: string; name: string; number: number; team: string; substitute?: boolean }[];
  races: (SeasonRace & {
    name: string;
    country: string;
    countryCode: string;
    circuit: string;
    city: string;
    date: string;
    qualiStartUTC?: string | null;
  })[];
}

export interface LegacyData {
  season: LegacySeasonFile;
  predictions: { predictions?: Record<string, Record<string, RaceTip>> };
  sprintPredictions: { sprintPredictions?: Record<string, Record<string, SprintTip>> };
  seasonPredictions: { seasonPredictions?: Record<string, SeasonTip> };
  results: { results?: Record<string, RaceResult> };
  sprintResults: { sprintResults?: Record<string, SprintResult> };
}

function byRound<T>(obj: Record<string, T> | undefined): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [round, value] of Object.entries(obj ?? {})) out[Number(round)] = value;
  return out;
}

export function legacyToGame(data: LegacyData): SeasonGame {
  return {
    players: data.season.players.map(p => ({ id: p.id })),
    races: data.season.races.map(r => ({
      round: r.round,
      sprint: !!r.sprint,
      raceStartUTC: r.raceStartUTC,
      sprintStartUTC: r.sprintStartUTC ?? null,
    })),
    raceTips: byRound(data.predictions.predictions),
    sprintTips: byRound(data.sprintPredictions.sprintPredictions),
    seasonTips: { ...(data.seasonPredictions.seasonPredictions ?? {}) },
    raceResults: byRound(data.results.results),
    sprintResults: byRound(data.sprintResults.sprintResults),
    final: null,
  };
}
