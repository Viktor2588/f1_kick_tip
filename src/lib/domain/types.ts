// Domain types. IDs are plain strings matching season.json (e.g. "verstappen", "mclaren").

export type DriverId = string;
export type TeamId = string;
export type PlayerId = string;
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
  raceStartUTC: string;
  qualiStartUTC: string;
  sprintStartUTC: string | null;
  sprint: boolean;
}

export interface Season {
  season: number;
  players: Player[];
  teams: Team[];
  drivers: Driver[];
  races: Race[];
  rules: { dnfFromRound: number };
  /** Final championship result, set once the season is over. Scores the season tips. */
  final: { wdc: DriverId; wcc: TeamId } | null;
}

/** A podium is always [P1, P2, P3]; the race winner is P1. */
export type Podium = [DriverId | null, DriverId | null, DriverId | null];

export interface RaceTip {
  podium: Podium;
  pole: DriverId | null;
  fastestLap: DriverId | null;
  bestConstructor: TeamId | null;
  dnf: DriverId | null;
  dns: DriverId | null;
  submittedAt: string;
}

export interface SprintTip {
  podium: Podium;
  submittedAt: string;
}

export interface SeasonTip {
  wdc: DriverId;
  wcc: TeamId;
  submittedAt: string;
}

export interface RaceResult {
  podium: Podium;
  pole: DriverId | null;
  fastestLap: DriverId | null;
  bestConstructor: TeamId | null;
  /** Present (possibly empty) only for rounds that score DNF/DNS. */
  dnf: DriverId[] | null;
  dns: DriverId[] | null;
  topTen: DriverId[] | null;
  enteredAt: string;
}

export interface SprintResult {
  podium: Podium;
  enteredAt: string;
}

/** Everything mutable in the game: tips and results. Keys are round numbers as strings. */
export interface GameData {
  raceTips: Record<string, Record<PlayerId, RaceTip>>;
  sprintTips: Record<string, Record<PlayerId, SprintTip>>;
  seasonTips: Record<PlayerId, SeasonTip>;
  raceResults: Record<string, RaceResult>;
  sprintResults: Record<string, SprintResult>;
}

/** A tip that exists but must not be shown yet (deadline still open). */
export interface HiddenTip {
  hidden: true;
  submittedAt: string;
}

export type Visible<T> = T | HiddenTip;

export function isHidden<T>(tip: Visible<T> | undefined | null): tip is HiddenTip {
  return !!tip && (tip as HiddenTip).hidden === true;
}

/** GameData as sent to the browser: other players' open tips are redacted. */
export interface PublicGameData {
  raceTips: Record<string, Record<PlayerId, Visible<RaceTip>>>;
  sprintTips: Record<string, Record<PlayerId, Visible<SprintTip>>>;
  seasonTips: Record<PlayerId, Visible<SeasonTip>>;
  raceResults: Record<string, RaceResult>;
  sprintResults: Record<string, SprintResult>;
}

export function emptyGameData(): GameData {
  return { raceTips: {}, sprintTips: {}, seasonTips: {}, raceResults: {}, sprintResults: {} };
}
