import { clock } from '../lib/clock';
import type { PlayerId, RaceResult, RaceTip, Round, SeasonTip, Snapshot, SprintResult, SprintTip } from '../domain/types';

type Without<T, K extends keyof T> = Omit<T, K>;

/** Everything the app can read or write. Two adapters: Neon (live) and Demo (in-browser). */
export interface Repo {
  readonly kind: 'live' | 'demo';
  load(): Promise<Snapshot>;
  saveRaceTip(round: Round, player: PlayerId, tip: Without<RaceTip, 'submittedAt'>): Promise<RaceTip>;
  saveSprintTip(round: Round, player: PlayerId, tip: Without<SprintTip, 'submittedAt'>): Promise<SprintTip>;
  saveSeasonTip(player: PlayerId, tip: Without<SeasonTip, 'submittedAt'>): Promise<SeasonTip>;
  saveRaceResult(round: Round, result: Without<RaceResult, 'enteredAt'>): Promise<RaceResult>;
  saveSprintResult(round: Round, result: Without<SprintResult, 'enteredAt'>): Promise<SprintResult>;
  deleteRaceResult(round: Round): Promise<void>;
  deleteSprintResult(round: Round): Promise<void>;
}

export async function createRepo(): Promise<Repo> {
  const url = import.meta.env.VITE_NEON_URL as string | undefined;
  const forceDemo = new URLSearchParams(location.search).has('demo') || location.hash.includes('demo=1');
  if (url && !forceDemo) {
    const { NeonRepo } = await import('./neon');
    return new NeonRepo(url);
  }
  const { DemoRepo } = await import('./demo');
  clock.allowOverride();
  return new DemoRepo();
}
