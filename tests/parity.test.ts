// Scoring parity: the rebuild's scoring must give exactly the same results as legacy/js/scoring.js.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as legacy from '../legacy/js/scoring.js';
import * as next from '../src/lib/scoring';
import { legacyToGame, type LegacyData } from '../src/lib/legacy-format';
import { legacyRowsToLegacyData } from '../src/lib/server/db/import';

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DRIVERS = ['norris', 'piastri', 'leclerc', 'hamilton', 'verstappen', 'russell', 'antonelli', 'alonso'];
const TEAMS = ['mclaren', 'ferrari', 'redbull', 'mercedes'];

function gen(r: () => number) {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const maybe = <T,>(v: T): T | '' | undefined => (r() < 0.12 ? (r() < 0.5 ? undefined : '') : v);
  const podium = () => {
    const a = [...DRIVERS].sort(() => r() - 0.5).slice(0, 3) as (string | undefined | null)[];
    if (r() < 0.1) a[1] = undefined;
    if (r() < 0.1) a[2] = null;
    return a;
  };
  const deadline = '2026-06-01T12:00:00Z';
  const submitted = () => (r() < 0.1 ? null : r() < 0.15 ? '2026-06-01T12:30:00Z' : r() < 0.05 ? deadline : '2026-06-01T10:00:00Z');
  const tipPodium = podium();
  const raceTip = {
    winner: r() < 0.8 ? tipPodium[0] : pick(DRIVERS),
    podium: r() < 0.05 ? undefined : tipPodium,
    pole: maybe(pick(DRIVERS)),
    fastestLap: maybe(pick(DRIVERS)),
    bestConstructor: maybe(pick(TEAMS)),
    dnf: r() < 0.5 ? pick(DRIVERS) : r() < 0.5 ? '' : null,
    dns: r() < 0.3 ? pick(DRIVERS) : null,
    submittedAt: submitted(),
  };
  const resPodium = podium();
  const hasLists = r() < 0.5;
  const raceResult = {
    winner: resPodium[0],
    podium: resPodium,
    pole: maybe(pick(DRIVERS)),
    fastestLap: maybe(pick(DRIVERS)),
    bestConstructor: maybe(pick(TEAMS)),
    dnf: hasLists ? DRIVERS.filter(() => r() < 0.2) : undefined,
    dns: hasLists ? DRIVERS.filter(() => r() < 0.1) : undefined,
  };
  // Make perfect rounds reasonably common
  if (r() < 0.15) Object.assign(raceResult, { winner: raceTip.winner, podium: [raceTip.winner, raceTip.podium?.[1], raceTip.podium?.[2]], pole: raceTip.pole, fastestLap: raceTip.fastestLap, bestConstructor: raceTip.bestConstructor });
  const sTipPodium = podium();
  const sprintTip = { winner: r() < 0.8 ? sTipPodium[0] : pick(DRIVERS), podium: r() < 0.05 ? undefined : sTipPodium, submittedAt: submitted() };
  const sResPodium = r() < 0.15 ? [...sTipPodium] : podium();
  const sprintResult = { winner: sResPodium[0], podium: r() < 0.03 ? undefined : sResPodium };
  return { raceTip, raceResult, sprintTip, sprintResult, timing: { raceStartUTC: deadline, sprintStartUTC: deadline } };
}

describe('scoring parity with legacy/js/scoring.js', () => {
  it('scoreRace and scoreSprint match on 20,000 random cases', () => {
    const r = rng(2026);
    for (let i = 0; i < 20000; i++) {
      const c = gen(r);
      expect(next.scoreRace(c.raceTip, c.raceResult, c.timing), `race case ${i}`).toEqual(legacy.scoreRace(c.raceTip, c.raceResult, c.timing));
      expect(next.scoreSprint(c.sprintTip, c.sprintResult, c.timing), `sprint case ${i}`).toEqual(legacy.scoreSprint(c.sprintTip, c.sprintResult, c.timing));
    }
  });

  it('missing tip or result gives the same empty score', () => {
    const t = { raceStartUTC: '2026-06-01T12:00:00Z' };
    expect(next.scoreRace(null, { winner: 'x' }, t)).toEqual(legacy.scoreRace(null, { winner: 'x' }, t));
    expect(next.scoreRace({ winner: 'x' }, null, t)).toEqual(legacy.scoreRace({ winner: 'x' }, null, t));
    expect(next.scoreSprint(null, null, t)).toEqual(legacy.scoreSprint(null, null, t));
  });

  it('season tips match', () => {
    const final = { wdc: 'russell', wcc: 'mercedes' };
    for (const tip of [{ wdc: 'russell', wcc: 'mercedes' }, { wdc: 'norris', wcc: 'mercedes' }, { wdc: 'russell', wcc: 'ferrari' }, {}]) {
      expect(next.scoreSeasonTip(tip, final)).toEqual(legacy.scoreSeasonPrediction(tip, final));
      expect(next.scoreSeasonTip(tip, null)).toEqual(legacy.scoreSeasonPrediction(tip, null));
    }
  });

  it('standings, tiebreakers and accuracy match on random full seasons', () => {
    const r = rng(7);
    const season = JSON.parse(readFileSync(join(import.meta.dirname, '../legacy/data/season.json'), 'utf8'));
    for (let s = 0; s < 40; s++) {
      const data: LegacyData = { season, predictions: { predictions: {} }, sprintPredictions: { sprintPredictions: {} }, seasonPredictions: { seasonPredictions: {} }, results: { results: {} }, sprintResults: { sprintResults: {} } };
      const playedRounds = Math.floor(r() * 24);
      for (const race of season.races) {
        if (race.round > playedRounds) continue;
        const key = String(race.round);
        data.predictions.predictions![key] = {};
        data.sprintPredictions.sprintPredictions![key] = {};
        for (const p of season.players) {
          const c = gen(r);
          if (r() < 0.9) data.predictions.predictions![key][p.id] = { ...c.raceTip, submittedAt: r() < 0.05 ? '2027-01-01T00:00:00Z' : c.raceTip.submittedAt && race.raceStartUTC };
          if (race.sprint && r() < 0.9) data.sprintPredictions.sprintPredictions![key][p.id] = { ...c.sprintTip, submittedAt: null };
        }
        const c = gen(r);
        if (r() < 0.95) data.results.results![key] = c.raceResult;
        if (race.sprint && r() < 0.95) data.sprintResults.sprintResults![key] = c.sprintResult;
      }
      for (const p of season.players) data.seasonPredictions.seasonPredictions![p.id] = { wdc: 'russell', wcc: r() < 0.5 ? 'mercedes' : 'mclaren' };
      const final = r() < 0.5 ? { wdc: 'russell', wcc: 'mercedes' } : null;

      const old = legacy.calculateStandings(season, data.predictions, data.sprintPredictions, data.results, data.sprintResults, data.seasonPredictions, final);
      const neu = next.calculateStandings({ ...legacyToGame(data), final });
      expect(neu, `season ${s}`).toEqual(old);
      for (let i = 0; i < old.length; i++) {
        expect(next.calculateAccuracy(neu[i].raceScores, neu[i].sprintScores)).toBe(legacy.calculateAccuracy(old[i].raceScores, old[i].sprintScores));
      }
    }
  });

  it('legacy demo data (legacy/data/test) gives identical standings', () => {
    const dir = join(import.meta.dirname, '../legacy/data/test');
    const load = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const data: LegacyData = {
      season: load('season.json'), predictions: load('predictions.json'), sprintPredictions: load('sprint-predictions.json'),
      seasonPredictions: load('season-predictions.json'), results: load('results.json'), sprintResults: load('sprint-results.json'),
    };
    const old = legacy.calculateStandings(data.season, data.predictions, data.sprintPredictions, data.results, data.sprintResults, data.seasonPredictions, null);
    const neu = next.calculateStandings(legacyToGame(data));
    expect(neu).toEqual(old);
    expect(neu.map(s => s.totalPoints).some(p => p > 0)).toBe(true);
  });

  // Runs once Viktor has allowed the read-only export (private/live-export.json, never committed).
  const exportPath = process.env.LIVE_EXPORT || join(import.meta.dirname, '../private/live-export.json');
  it.skipIf(!existsSync(exportPath))('real 2026 export gives identical standings', () => {
    const season = JSON.parse(readFileSync(join(import.meta.dirname, '../legacy/data/season.json'), 'utf8'));
    const data: LegacyData = legacyRowsToLegacyData(season, JSON.parse(readFileSync(exportPath, 'utf8')));
    const old = legacy.calculateStandings(data.season, data.predictions, data.sprintPredictions, data.results, data.sprintResults, data.seasonPredictions, null);
    expect(next.calculateStandings(legacyToGame(data))).toEqual(old);
  });
});
