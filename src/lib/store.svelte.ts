import seasonJson from '../data/season.json';
import { createRepo, type Repo } from '../data/repo';
import type { Driver, PlayerId, Player, Season, Snapshot, Team } from '../domain/types';
import { emptySnapshot } from '../domain/types';
import { computeStandings } from '../domain/standings';
import { clock } from './clock';

const ME_KEY = 'f1_player'; // same key as the old app, so nobody has to pick again

function readMe(): PlayerId | null {
  try { return localStorage.getItem(ME_KEY); } catch { return null; }
}

class AppStore {
  readonly season = seasonJson as Season;
  snap = $state<Snapshot>(emptySnapshot());
  status = $state<'loading' | 'ready' | 'error'>('loading');
  error = $state<string | null>(null);
  me = $state<PlayerId | null>(readMe());
  now = $state(Date.now());
  repo: Repo | null = null;
  mode = $state<'live' | 'demo'>('demo');

  standings = $derived(computeStandings(this.season, this.snap));

  private drivers = new Map(this.season.drivers.map((d) => [d.id, d]));
  private teams = new Map(this.season.teams.map((t) => [t.id, t]));
  private players = new Map(this.season.players.map((p) => [p.id, p]));

  get player(): Player | null {
    return (this.me && this.players.get(this.me)) || null;
  }

  async init() {
    try {
      this.repo = await createRepo();
      this.mode = this.repo.kind;
      this.now = clock.now();
      setInterval(() => (this.now = clock.now()), 1000);
      await this.refresh();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refresh(true);
      });
    } catch (e) {
      this.fail(e);
    }
  }

  async refresh(silent = false) {
    if (!this.repo) return;
    try {
      this.snap = await this.repo.load();
      this.status = 'ready';
      this.error = null;
    } catch (e) {
      if (!silent || this.status !== 'ready') this.fail(e);
    }
  }

  private fail(e: unknown) {
    console.error(e);
    this.error = e instanceof Error ? e.message : String(e);
    if (this.status !== 'ready') this.status = 'error';
  }

  setMe(id: PlayerId | null) {
    this.me = id;
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch { /* ignore */ }
  }

  driver = (id: string | null | undefined): Driver | undefined => (id ? this.drivers.get(id) : undefined);
  team = (id: string | null | undefined): Team | undefined => (id ? this.teams.get(id) : undefined);
  playerById = (id: string): Player | undefined => this.players.get(id);
  driverColor = (id: string | null | undefined) => this.team(this.driver(id)?.team)?.color ?? '#777';
  lastName = (id: string | null | undefined) => {
    const d = this.driver(id);
    return d ? d.name.split(' ').slice(1).join(' ') || d.name : id ?? '–';
  };
  race = (round: number) => this.season.races.find((r) => r.round === round);
}

export const app = new AppStore();
