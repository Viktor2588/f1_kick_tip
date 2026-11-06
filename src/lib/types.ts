import type { SeasonGame } from './scoring';

export interface Team { id: string; name: string; color: string }
export interface Driver { id: string; name: string; number: number; teamId: string }
export interface Player { id: string; name: string; emoji: string; color: string }
export interface Race {
  round: number;
  name: string;
  country: string;
  countryCode: string;
  circuit: string;
  city: string;
  date: string;
  qualiStartUTC: string | null;
  sprintStartUTC: string | null;
  raceStartUTC: string;
  sprint: boolean;
}

export interface SeasonData {
  year: number;
  teams: Team[];
  drivers: Driver[];
  races: Race[];
  players: Player[];
  game: SeasonGame;
}
