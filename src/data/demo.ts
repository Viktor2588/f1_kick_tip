// Demo adapter: a believable season generated in the browser, persisted to
// localStorage so tips you enter survive a reload. Used for local development,
// previews and tests, so nobody ever writes to the live database by accident.
import type { Repo } from './repo';
import type { Driver, RaceResult, RaceTip, Season, SeasonTip, Snapshot, SprintResult, SprintTip } from '../domain/types';
import { emptySnapshot } from '../domain/types';
import { DNF_FROM_ROUND } from '../domain/rules';
import seasonJson from './season.json';
import { clock } from '../lib/clock';

import { DEMO_KEY as KEY } from './demo-key';

/** Small deterministic PRNG so every demo season looks the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRENGTH: Record<string, number> = {
  norris: 10, piastri: 9.5, verstappen: 9.5, russell: 8.5, leclerc: 8, hamilton: 7, antonelli: 7,
  hadjar: 5, alonso: 4.5, albon: 4, sainz: 4, lawson: 3, lindblad: 3, gasly: 3, bearman: 3,
  hulkenberg: 2.5, bortoleto: 2.5, ocon: 2.5, stroll: 2, colapinto: 2, bottas: 1.5, perez: 1.5, hirakawa: 1,
};

function weightedOrder(drivers: Driver[], rnd: () => number, noise: number): string[] {
  return drivers
    .map((d) => ({ id: d.id, s: (STRENGTH[d.id] ?? 1) + rnd() * noise }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
}

export function generateDemo(season: Season, now: number): Snapshot {
  const rnd = mulberry32(2026);
  const snap = emptySnapshot();
  const drivers = season.drivers.filter((d) => d.id !== 'hirakawa');
  const teamOf = (id: string) => season.drivers.find((d) => d.id === id)!.team;
  const style: Record<string, number> = { thomas: 5, julia: 7, viktor: 6 }; // how "wild" each player tips

  for (const race of season.races) {
    const start = new Date(race.raceStartUTC).getTime();
    const hasResult = start + 20 * 3_600_000 < now; // results land the morning after
    const tipsDue = start - 6 * 3_600_000 < now || hasResult;
    const withDnf = race.round >= DNF_FROM_ROUND;

    let result: RaceResult | null = null;
    if (hasResult) {
      const order = weightedOrder(drivers, rnd, 9);
      const out = order.slice(-6).filter(() => rnd() < 0.3);
      result = {
        p1: order[0], p2: order[1], p3: order[2],
        pole: weightedOrder(drivers, rnd, 7)[0],
        fastestLap: order[Math.floor(rnd() * 5)],
        bestConstructor: teamOf(order[0]) === teamOf(order[1]) || rnd() < 0.6 ? teamOf(order[0]) : teamOf(order[1]),
        dnf: withDnf ? out.slice(0, 2) : null,
        dns: withDnf ? (rnd() < 0.25 ? [order[order.length - 1]] : []) : null,
        topTen: order.slice(0, 10),
        enteredAt: new Date(start + 19 * 3_600_000).toISOString(),
      };
      snap.raceResults[race.round] = result;
    }

    for (const p of season.players) {
      // The next open race: only Thomas has tipped already, to show the "who's in" state.
      if (!tipsDue && !(p.id === 'thomas' && start - now < 3 * 86_400_000 && start > now)) continue;
      if (rnd() < 0.05) continue; // somebody forgets now and then
      const order = weightedOrder(drivers, rnd, style[p.id] ?? 6);
      const late = rnd() < 0.03;
      const tip: RaceTip = {
        p1: order[0], p2: order[1], p3: order[2],
        pole: weightedOrder(drivers, rnd, style[p.id] ?? 6)[0],
        fastestLap: order[Math.floor(rnd() * 4)],
        bestConstructor: teamOf(order[rnd() < 0.7 ? 0 : 1]),
        dnf: withDnf ? order[order.length - 1 - Math.floor(rnd() * 6)] : null,
        dns: withDnf && rnd() < 0.5 ? order[order.length - 1] : null,
        submittedAt: new Date(start - (late ? -600_000 : (2 + rnd() * 40) * 3_600_000)).toISOString(),
      };
      if (tip.dnf && tip.dnf === tip.dns) tip.dns = null;
      (snap.raceTips[race.round] ??= {})[p.id] = tip;
    }

    if (race.sprint && race.sprintStartUTC) {
      const sStart = new Date(race.sprintStartUTC).getTime();
      if (sStart + 10 * 3_600_000 < now) {
        const order = weightedOrder(drivers, rnd, 8);
        snap.sprintResults[race.round] = { p1: order[0], p2: order[1], p3: order[2], enteredAt: new Date(sStart + 9 * 3_600_000).toISOString() };
      }
      if (sStart < now) {
        for (const p of season.players) {
          if (rnd() < 0.1) continue;
          const order = weightedOrder(drivers, rnd, style[p.id] ?? 6);
          (snap.sprintTips[race.round] ??= {})[p.id] = { p1: order[0], p2: order[1], p3: order[2], submittedAt: new Date(sStart - 5 * 3_600_000).toISOString() };
        }
      }
    }
  }

  const r1 = new Date(season.races[0].raceStartUTC).getTime();
  if (r1 < now) {
    const picks: Record<string, [string, string]> = { thomas: ['verstappen', 'redbull'], julia: ['norris', 'mclaren'], viktor: ['russell', 'mercedes'] };
    for (const p of season.players) {
      const [wdc, wcc] = picks[p.id] ?? ['norris', 'mclaren'];
      snap.seasonTips[p.id] = { wdc, wcc, submittedAt: new Date(r1 - 5 * 86_400_000).toISOString() };
    }
  }
  return snap;
}

export class DemoRepo implements Repo {
  readonly kind = 'demo' as const;
  private snap: Snapshot;

  constructor() {
    let stored: Snapshot | null = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private mode */ }
    this.snap = stored ?? generateDemo(seasonJson as Season, clock.now());
  }

  private persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.snap)); } catch { /* ignore */ }
  }

  private async write<T>(fn: () => T): Promise<T> {
    await new Promise((r) => setTimeout(r, 250)); // feel like a network round trip
    const out = fn();
    this.persist();
    return out;
  }

  async load() {
    return structuredClone(this.snap);
  }

  // Demo writes are stamped with the (possibly simulated) clock, so a simulated
  // "before the deadline" moment produces a valid tip.
  private stamp = () => new Date(clock.now()).toISOString();

  saveRaceTip(round: number, player: string, t: Omit<RaceTip, 'submittedAt'>) {
    return this.write(() => ((this.snap.raceTips[round] ??= {})[player] = { ...t, submittedAt: this.stamp() }));
  }
  saveSprintTip(round: number, player: string, t: Omit<SprintTip, 'submittedAt'>) {
    return this.write(() => ((this.snap.sprintTips[round] ??= {})[player] = { ...t, submittedAt: this.stamp() }));
  }
  saveSeasonTip(player: string, t: Omit<SeasonTip, 'submittedAt'>) {
    return this.write(() => (this.snap.seasonTips[player] = { ...t, submittedAt: this.stamp() }));
  }
  saveRaceResult(round: number, r: Omit<RaceResult, 'enteredAt'>) {
    return this.write(() => (this.snap.raceResults[round] = { ...r, enteredAt: this.stamp() }));
  }
  saveSprintResult(round: number, r: Omit<SprintResult, 'enteredAt'>) {
    return this.write(() => (this.snap.sprintResults[round] = { ...r, enteredAt: this.stamp() }));
  }
  deleteRaceResult(round: number) {
    return this.write(() => { delete this.snap.raceResults[round]; });
  }
  deleteSprintResult(round: number) {
    return this.write(() => { delete this.snap.sprintResults[round]; });
  }
}
