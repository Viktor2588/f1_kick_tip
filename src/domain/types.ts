// Core domain model. Everything the UI shows is derived from a Season (static config)
// plus a Snapshot (everything players and the admin have written).

export type PlayerId = string;
export type DriverId = string;
export type TeamId = string;
export type Round = number;

export interface Player {
  id: PlayerId;
  name: string;
  emoji: string;
  color: string;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  drivers: DriverId[];
}

export interface Driver {
  id: DriverId;
  name: string;
  number: number;
  team: TeamId;
}

export interface Race {
  round: Round;
  name: string;
  country: string;
  countryCode: string;
  circuit: string;
  city: string;
  date: string;
  raceStartUTC: string;
  qualiStartUTC: string | null;
  sprintStartUTC: string | null;
  sprint: boolean;
}

export interface Season {
  season: number;
  players: Player[];
  teams: Team[];
  drivers: Driver[];
  races: Race[];
  /** Champions, filled in once the season is over. Resolves the season tips. */
  final?: { wdc?: DriverId | null; wcc?: TeamId | null } | null;
}

/** A main-race tip. p1 is the race winner. */
export interface RaceTip {
  p1: DriverId;
  p2: DriverId;
  p3: DriverId;
  pole: DriverId;
  fastestLap: DriverId;
  bestConstructor: TeamId;
  dnf?: DriverId | null;
  dns?: DriverId | null;
  submittedAt: string;
}

export interface RaceResult {
  p1: DriverId;
  p2: DriverId;
  p3: DriverId;
  pole: DriverId;
  fastestLap: DriverId;
  bestConstructor: TeamId;
  /** Present (possibly empty) only from the round on which DNF/DNS tips exist. */
  dnf?: DriverId[] | null;
  dns?: DriverId[] | null;
  /** Not scored. Kept so a re-save does not drop it. */
  topTen?: DriverId[] | null;
  enteredAt: string;
}

export interface SprintTip {
  p1: DriverId;
  p2: DriverId;
  p3: DriverId;
  submittedAt: string;
}

export interface SprintResult {
  p1: DriverId;
  p2: DriverId;
  p3: DriverId;
  enteredAt: string;
}

export interface SeasonTip {
  wdc: DriverId;
  wcc: TeamId;
  submittedAt: string;
}

export type ByRound<T> = Record<string, T>;
export type ByPlayer<T> = Record<PlayerId, T>;

export interface Snapshot {
  raceTips: ByRound<ByPlayer<RaceTip>>;
  sprintTips: ByRound<ByPlayer<SprintTip>>;
  seasonTips: ByPlayer<SeasonTip>;
  raceResults: ByRound<RaceResult>;
  sprintResults: ByRound<SprintResult>;
}

export const emptySnapshot = (): Snapshot => ({
  raceTips: {},
  sprintTips: {},
  seasonTips: {},
  raceResults: {},
  sprintResults: {},
});
