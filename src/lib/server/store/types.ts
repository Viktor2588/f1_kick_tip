import type { GameData, PlayerId, RaceResult, RaceTip, SeasonTip, SprintResult, SprintTip } from '$lib/domain/types';

/** Persistence port. Two adapters: JSON files (dev/e2e) and Neon Postgres (production). */
export interface Store {
  load(): Promise<GameData>;
  saveRaceTip(round: number, player: PlayerId, tip: RaceTip): Promise<void>;
  saveSprintTip(round: number, player: PlayerId, tip: SprintTip): Promise<void>;
  saveSeasonTip(player: PlayerId, tip: SeasonTip): Promise<void>;
  saveRaceResult(round: number, result: RaceResult): Promise<void>;
  deleteRaceResult(round: number): Promise<void>;
  saveSprintResult(round: number, result: SprintResult): Promise<void>;
  deleteSprintResult(round: number): Promise<void>;
}
