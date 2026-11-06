// Live adapter. Reads and writes the exact tables the previous app used, so the
// rebuild is a drop-in replacement with no migration.
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Repo } from './repo';
import type { RaceResult, RaceTip, SeasonTip, Snapshot, SprintResult, SprintTip } from '../domain/types';
import { emptySnapshot } from '../domain/types';

type Row = Record<string, any>;

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : v ? String(v) : '');
const opt = (v: unknown): string | null => (v ? String(v) : null);
const list = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

export class NeonRepo implements Repo {
  readonly kind = 'live' as const;
  private sql: NeonQueryFunction<false, false>;

  constructor(url: string) {
    this.sql = neon(url);
  }

  async load(): Promise<Snapshot> {
    const sql = this.sql;
    const [rp, sp, se, rr, sr] = (await sql.transaction([
      sql`SELECT * FROM race_predictions`,
      sql`SELECT * FROM sprint_predictions`,
      sql`SELECT * FROM season_predictions`,
      sql`SELECT * FROM race_results`,
      sql`SELECT * FROM sprint_results`,
    ])) as Row[][];

    const snap = emptySnapshot();
    for (const r of rp) {
      (snap.raceTips[r.round] ??= {})[r.player_id] = {
        // The winner column is authoritative for P1 (podium_p1 is a copy).
        p1: r.winner, p2: r.podium_p2, p3: r.podium_p3,
        pole: r.pole, fastestLap: r.fastest_lap, bestConstructor: r.best_constructor,
        dnf: opt(r.dnf), dns: opt(r.dns), submittedAt: iso(r.submitted_at),
      };
    }
    for (const r of sp) {
      (snap.sprintTips[r.round] ??= {})[r.player_id] = { p1: r.winner, p2: r.podium_p2, p3: r.podium_p3, submittedAt: iso(r.submitted_at) };
    }
    for (const r of se) snap.seasonTips[r.player_id] = { wdc: r.wdc, wcc: r.wcc, submittedAt: iso(r.submitted_at) };
    for (const r of rr) {
      snap.raceResults[r.round] = {
        p1: r.winner, p2: r.podium_p2, p3: r.podium_p3,
        pole: r.pole, fastestLap: r.fastest_lap, bestConstructor: r.best_constructor,
        topTen: list(r.top_ten), dnf: list(r.dnf), dns: list(r.dns), enteredAt: iso(r.entered_at),
      };
    }
    for (const r of sr) snap.sprintResults[r.round] = { p1: r.winner, p2: r.podium_p2, p3: r.podium_p3, enteredAt: iso(r.entered_at) };
    return snap;
  }

  async saveRaceTip(round: number, player: string, t: Omit<RaceTip, 'submittedAt'>): Promise<RaceTip> {
    const now = new Date().toISOString();
    await this.sql`INSERT INTO race_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, dnf, dns, submitted_at)
      VALUES (${round}, ${player}, ${t.p1}, ${t.p1}, ${t.p2}, ${t.p3}, ${t.pole}, ${t.fastestLap}, ${t.bestConstructor}, ${t.dnf ?? ''}, ${t.dns ?? ''}, ${now})
      ON CONFLICT (round, player_id) DO UPDATE SET
        winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
        podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
        best_constructor = EXCLUDED.best_constructor, dnf = EXCLUDED.dnf, dns = EXCLUDED.dns,
        submitted_at = EXCLUDED.submitted_at`;
    return { ...t, submittedAt: now };
  }

  async saveSprintTip(round: number, player: string, t: Omit<SprintTip, 'submittedAt'>): Promise<SprintTip> {
    const now = new Date().toISOString();
    await this.sql`INSERT INTO sprint_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, submitted_at)
      VALUES (${round}, ${player}, ${t.p1}, ${t.p1}, ${t.p2}, ${t.p3}, ${now})
      ON CONFLICT (round, player_id) DO UPDATE SET
        winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
        podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
        submitted_at = EXCLUDED.submitted_at`;
    return { ...t, submittedAt: now };
  }

  async saveSeasonTip(player: string, t: Omit<SeasonTip, 'submittedAt'>): Promise<SeasonTip> {
    const now = new Date().toISOString();
    await this.sql`INSERT INTO season_predictions (player_id, wdc, wcc, submitted_at)
      VALUES (${player}, ${t.wdc}, ${t.wcc}, ${now})
      ON CONFLICT (player_id) DO UPDATE SET wdc = EXCLUDED.wdc, wcc = EXCLUDED.wcc, submitted_at = EXCLUDED.submitted_at`;
    return { ...t, submittedAt: now };
  }

  async saveRaceResult(round: number, r: Omit<RaceResult, 'enteredAt'>): Promise<RaceResult> {
    const now = new Date().toISOString();
    await this.sql`INSERT INTO race_results (round, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, top_ten, dnf, dns, entered_at)
      VALUES (${round}, ${r.p1}, ${r.p1}, ${r.p2}, ${r.p3}, ${r.pole}, ${r.fastestLap}, ${r.bestConstructor},
              ${r.topTen ?? null}, ${r.dnf ?? null}, ${r.dns ?? null}, ${now})
      ON CONFLICT (round) DO UPDATE SET
        winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
        podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
        best_constructor = EXCLUDED.best_constructor, top_ten = EXCLUDED.top_ten,
        dnf = EXCLUDED.dnf, dns = EXCLUDED.dns, entered_at = EXCLUDED.entered_at`;
    return { ...r, enteredAt: now };
  }

  async saveSprintResult(round: number, r: Omit<SprintResult, 'enteredAt'>): Promise<SprintResult> {
    const now = new Date().toISOString();
    await this.sql`INSERT INTO sprint_results (round, winner, podium_p1, podium_p2, podium_p3, entered_at)
      VALUES (${round}, ${r.p1}, ${r.p1}, ${r.p2}, ${r.p3}, ${now})
      ON CONFLICT (round) DO UPDATE SET
        winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
        podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3, entered_at = EXCLUDED.entered_at`;
    return { ...r, enteredAt: now };
  }

  async deleteRaceResult(round: number) {
    await this.sql`DELETE FROM race_results WHERE round = ${round}`;
  }

  async deleteSprintResult(round: number) {
    await this.sql`DELETE FROM sprint_results WHERE round = ${round}`;
  }
}
