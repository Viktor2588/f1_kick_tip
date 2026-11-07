// Parity: the new engine and import path must give exactly what the original 2026 code gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as legacy from './reference/legacy-scoring.js';
import { scoreRace, scoreSprint, calculateStandings } from '../src/shared/scoring.js';
import { seasonRows, dataRows } from '../src/shared/import.js';
import { rowsToGame } from '../src/shared/model.js';
import { legacyAppDataFromSource, legacyStandings, compareStandingsLists } from './reference/legacy-adapter.js';

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const season = readJson('../seed/season-2026.json');

function importAndCompare(seasonData, data) {
  const { rows } = dataRows(data, seasonData.players.map((p) => p.id));
  const game = rowsToGame({ ...seasonRows(seasonData), ...rows, news: [] });
  const ours = calculateStandings(game);
  const theirs = legacyStandings(seasonData, legacyAppDataFromSource(data), game.seasonFinal);
  return { ours, theirs, diff: compareStandingsLists(theirs, ours) };
}

test('legacy test fixtures (data/test/*) import with identical standings', () => {
  const dir = '../fixtures/legacy/';
  const legacySeason = readJson(dir + 'season.json');
  const data = {
    predictions: readJson(dir + 'predictions.json'), sprintPredictions: readJson(dir + 'sprint-predictions.json'),
    seasonPredictions: readJson(dir + 'season-predictions.json'), results: readJson(dir + 'results.json'), sprintResults: readJson(dir + 'sprint-results.json'),
  };
  const { ours, diff } = importAndCompare(legacySeason, data);
  assert.equal(diff, null);
  assert.ok(ours.some((s) => s.totalPoints > 0));
});

test('demo season (rounds 1–19, sprints, DNF/DNS, a late tip) imports with identical standings', () => {
  const { ours, diff } = importAndCompare(season, readJson('../fixtures/demo-2026.json'));
  assert.equal(diff, null);
  assert.ok(ours[0].totalPoints > 50);
});

test('raw table rows (old Postgres export shape) import with identical standings', () => {
  // Build raw rows from the demo data the way the old DB stored them ('' for empty, arrays for lists).
  const demo = readJson('../fixtures/demo-2026.json');
  const raw = { race_predictions: [], sprint_predictions: [], season_predictions: [], race_results: [], sprint_results: [] };
  for (const [round, byP] of Object.entries(demo.predictions.predictions)) for (const [pid, t] of Object.entries(byP)) raw.race_predictions.push({
    round: Number(round), player_id: pid, winner: t.winner, podium_p1: t.podium[0] || '', podium_p2: t.podium[1] || '', podium_p3: t.podium[2] || '',
    pole: t.pole || '', fastest_lap: t.fastestLap || '', best_constructor: t.bestConstructor || '', dnf: t.dnf || '', dns: t.dns || '', submitted_at: t.submittedAt,
  });
  for (const [round, byP] of Object.entries(demo.sprintPredictions.sprintPredictions)) for (const [pid, t] of Object.entries(byP)) raw.sprint_predictions.push({
    round: Number(round), player_id: pid, winner: t.winner, podium_p1: t.podium[0], podium_p2: t.podium[1], podium_p3: t.podium[2], submitted_at: t.submittedAt,
  });
  for (const [pid, t] of Object.entries(demo.seasonPredictions.seasonPredictions)) raw.season_predictions.push({ player_id: pid, wdc: t.wdc, wcc: t.wcc, submitted_at: t.submittedAt });
  for (const [round, r] of Object.entries(demo.results.results)) raw.race_results.push({
    round: Number(round), winner: r.winner, podium_p1: r.podium[0], podium_p2: r.podium[1], podium_p3: r.podium[2], pole: r.pole, fastest_lap: r.fastestLap,
    best_constructor: r.bestConstructor, top_ten: r.topTen, dnf: r.dnf ?? null, dns: r.dns ?? null, entered_at: r.enteredAt,
  });
  for (const [round, r] of Object.entries(demo.sprintResults.sprintResults)) raw.sprint_results.push({ round: Number(round), winner: r.winner, podium_p1: r.podium[0], podium_p2: r.podium[1], podium_p3: r.podium[2], entered_at: r.enteredAt });

  const { diff } = importAndCompare(season, raw);
  assert.equal(diff, null);
});

test('tips from names outside the roster are skipped, as the old standings ignored them', () => {
  const data = { predictions: { 1: { gast: { winner: 'norris', podium: ['norris'], submittedAt: '2026-03-07T00:00:00Z' } } }, results: { 1: { winner: 'norris', podium: ['norris', 'x', 'y'] } } };
  const { rows, skippedPlayers } = dataRows(data, season.players.map((p) => p.id));
  assert.deepEqual(skippedPlayers, ['gast']);
  assert.equal(rows.race_tips.length, 0);
  assert.equal(importAndCompare(season, data).diff, null);
});

// Randomised: thousands of race/sprint inputs, including empty strings, missing fields, swapped podiums, late tips.
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pool = ['a', 'b', 'c', 'd', 'e', '', undefined, null];
const any = () => pool[Math.floor(rand() * pool.length)];
const trio = () => (rand() < 0.1 ? undefined : [any(), any(), any()]);
const when = () => (rand() < 0.1 ? undefined : `2026-06-0${1 + Math.floor(rand() * 2)}T1${Math.floor(rand() * 4)}:00:00Z`);
const lst = () => (rand() < 0.3 ? undefined : ['a', 'b', 'c', 'd', 'e'].filter(() => rand() < 0.3));

test('random race inputs: new scoreRace equals the original', () => {
  for (let i = 0; i < 5000; i++) {
    const tip = rand() < 0.03 ? null : { winner: any(), podium: trio(), pole: any(), fastestLap: any(), bestConstructor: any(), dnf: any(), dns: any(), submittedAt: when() };
    const result = rand() < 0.03 ? null : { winner: any(), podium: trio(), pole: any(), fastestLap: any(), bestConstructor: any(), dnf: lst(), dns: lst() };
    const r = { raceStartUTC: rand() < 0.1 ? undefined : '2026-06-01T12:00:00Z' };
    assert.deepEqual(scoreRace(tip, result, r), legacy.scoreRace(tip, result, r), JSON.stringify({ tip, result, r }));
  }
});

test('random sprint inputs: new scoreSprint equals the original', () => {
  for (let i = 0; i < 5000; i++) {
    const tip = rand() < 0.03 ? null : { winner: any(), podium: trio(), submittedAt: when() };
    const result = rand() < 0.03 ? null : { winner: any(), podium: trio() };
    const r = { sprintStartUTC: '2026-06-01T12:00:00Z' };
    assert.deepEqual(scoreSprint(tip, result, r), legacy.scoreSprint(tip, result, r), JSON.stringify({ tip, result }));
  }
});
