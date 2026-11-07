// Parity: the new engine must score exactly like the legacy one on legacy-shaped data.
// 20 000 random seasons-worth of tips/results, compared field by field, plus full standings.

import { describe, expect, it } from 'vitest';
// plain JS oracle (allowJs)
import * as legacy from './legacy-scoring.js';
import { calculateStandings, scoreRace, scoreSprint } from '../../src/lib/domain/scoring';
import { fromLegacyFiles, raceResultFromLegacy, raceTipFromLegacy, sprintResultFromLegacy, sprintTipFromLegacy } from '../../src/lib/server/store/legacy-format';
import seasonJson from '../../src/lib/domain/season.json';
import type { Season } from '../../src/lib/domain/types';

const season = seasonJson as Season;
const DRIVERS = ['norris', 'piastri', 'leclerc', 'hamilton', 'verstappen', 'russell', 'antonelli', 'alonso'];
const TEAMS = ['mclaren', 'ferrari', 'redbull', 'mercedes'];

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const r = rng(42);
const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
const maybe = <T>(v: T, p = 0.15): T | '' => (r() < p ? '' : v);
const podium = () => {
  const s = [...DRIVERS].sort(() => r() - 0.5);
  return [s[0], s[1], s[2]];
};

/** Legacy results were always complete; tips could leave optional fields blank. */
function legacyResult(withDnf: boolean) {
  const p = podium();
  return {
    winner: p[0], podium: p, pole: pick(DRIVERS), fastestLap: pick(DRIVERS), bestConstructor: pick(TEAMS),
    ...(withDnf ? { dnf: DRIVERS.filter(() => r() < 0.2), dns: DRIVERS.filter(() => r() < 0.08) } : {}),
  };
}
function legacyTip(res: ReturnType<typeof legacyResult>, deadline: string) {
  // Bias towards the result so perfect rounds and bonuses actually occur.
  const p = r() < 0.3 ? [...res.podium] : r() < 0.5 ? [res.podium[1], res.podium[0], res.podium[2]] : podium();
  const late = r() < 0.05;
  return {
    winner: p[0], podium: p,
    pole: maybe(r() < 0.5 ? res.pole : pick(DRIVERS)),
    fastestLap: maybe(r() < 0.5 ? res.fastestLap : pick(DRIVERS)),
    bestConstructor: maybe(r() < 0.5 ? res.bestConstructor : pick(TEAMS)),
    dnf: maybe(pick(DRIVERS), 0.5), dns: maybe(pick(DRIVERS), 0.6),
    submittedAt: new Date(Date.parse(deadline) + (late ? 60_000 : -3_600_000)).toISOString(),
  };
}

describe('parity with legacy scoring.js', () => {
  it('scoreRace matches on 20 000 random cases', () => {
    const seen = { perfect: 0, late: 0, bonus: 0, dnf: 0, dns: 0, blankPick: 0 };
    for (let i = 0; i < 20_000; i++) {
      const race = pick(season.races);
      const res = legacyResult(race.round >= 16);
      const t = legacyTip(res, race.raceStartUTC);
      const a = legacy.scoreRace(t, res, race);
      const b = scoreRace(raceTipFromLegacy(t), raceResultFromLegacy(res), race);
      expect({ total: b.total, breakdown: b.breakdown, isPerfect: b.isPerfect, max: b.max }, JSON.stringify({ t, res }))
        .toEqual({ total: a.total, breakdown: a.breakdown, isPerfect: a.isPerfect, max: a.max });
      seen.perfect += +b.isPerfect; seen.late += +b.late; seen.bonus += +(b.breakdown.podiumBonus > 0);
      seen.dnf += +(b.breakdown.dnf > 0); seen.dns += +(b.breakdown.dns > 0); seen.blankPick += +(t.pole === '');
    }
    // The fuzz must actually reach every branch, not pass vacuously.
    for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(50);
  });

  it('scoreSprint matches on 5 000 random cases', () => {
    const sprints = season.races.filter((x) => x.sprint);
    for (let i = 0; i < 5_000; i++) {
      const race = pick(sprints);
      const p = podium();
      const res = { winner: p[0], podium: p };
      const tp = r() < 0.3 ? [...p] : podium();
      const t = { winner: tp[0], podium: tp, submittedAt: new Date(Date.parse(race.sprintStartUTC!) + (r() < 0.05 ? 1 : -1) * 60_000).toISOString() };
      const a = legacy.scoreSprint(t, res, race);
      const b = scoreSprint(sprintTipFromLegacy(t), sprintResultFromLegacy(res), race);
      expect({ total: b.total, breakdown: b.breakdown, isPerfect: b.isPerfect }).toEqual({ total: a.total, breakdown: a.breakdown, isPerfect: a.isPerfect });
    }
  });

  it('full standings match on 200 random seasons', () => {
    for (let n = 0; n < 200; n++) {
      const files = { predictions: { predictions: {} as any }, sprintPredictions: { sprintPredictions: {} as any }, seasonPredictions: { seasonPredictions: {} }, results: { results: {} as any }, sprintResults: { sprintResults: {} as any } };
      for (const race of season.races.slice(0, 19)) {
        const k = String(race.round);
        const res = legacyResult(race.round >= 16);
        if (r() < 0.9) files.results.results[k] = res;
        files.predictions.predictions[k] = {};
        for (const p of season.players) if (r() < 0.9) files.predictions.predictions[k][p.id] = legacyTip(res, race.raceStartUTC);
        if (race.sprint) {
          const sp = podium();
          files.sprintResults.sprintResults[k] = { winner: sp[0], podium: sp };
          files.sprintPredictions.sprintPredictions[k] = {};
          for (const p of season.players) {
            const tp = r() < 0.4 ? [...sp] : podium();
            files.sprintPredictions.sprintPredictions[k][p.id] = { winner: tp[0], podium: tp, submittedAt: '2026-01-01T00:00:00Z' };
          }
        }
      }
      const a = legacy.calculateStandings(season, files.predictions, files.sprintPredictions, files.results, files.sprintResults, files.seasonPredictions, null);
      const b = calculateStandings(season, fromLegacyFiles(files));
      const view = (rows: any[]) => rows.map((x) => [x.playerId, x.totalPoints, x.racePoints, x.sprintPoints, x.correctWinners, x.perfectRounds, x.correctPoles]);
      // Order can differ only for full ties (legacy kept insertion order; so does Array.sort – stable).
      expect(view(b)).toEqual(view(a));
      for (const row of b) {
        const old = a.find((x: any) => x.playerId === row.playerId)!;
        expect(row.accuracy).toBe(legacy.calculateAccuracy(old.raceScores, old.sprintScores));
      }
    }
  });
});
