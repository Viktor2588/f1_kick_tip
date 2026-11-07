import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRace, scoreSprint, scoreSeason, calculateStandings, isLate, accuracy } from '../src/shared/scoring.js';

// ── Cases ported 1:1 from test-scoring.html (main @ 6609b25) ──
const race = { raceStartUTC: '2026-06-01T12:00:00Z' };
const basePrediction = {
  winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton',
  bestConstructor: 'mclaren', submittedAt: '2026-06-01T11:00:00Z',
};
const neutralResult = { pole: 'russell', fastestLap: 'sainz', bestConstructor: 'ferrari' };

const legacyCases = [
  { name: 'P1 exakt gibt keinen Bonus', prediction: basePrediction, result: { ...neutralResult, winner: 'norris', podium: ['norris', 'russell', 'hamilton'] }, expect: { winner: 3, podiumBonus: 0, total: 3 } },
  { name: 'Getippter Sieger endet auf P2', prediction: basePrediction, result: { ...neutralResult, winner: 'russell', podium: ['russell', 'norris', 'hamilton'] }, expect: { winner: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter Sieger endet auf P3', prediction: basePrediction, result: { ...neutralResult, winner: 'russell', podium: ['russell', 'hamilton', 'norris'] }, expect: { winner: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter P2 endet auf P1', prediction: basePrediction, result: { ...neutralResult, winner: 'piastri', podium: ['piastri', 'hamilton', 'russell'] }, expect: { podiumP2: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter P3 endet auf P1', prediction: basePrediction, result: { ...neutralResult, winner: 'leclerc', podium: ['leclerc', 'hamilton', 'russell'] }, expect: { podiumP3: 0, podiumBonus: 1, total: 1 } },
  { name: 'Kombinierter P1↔P2-Tausch zählt beide Boni', prediction: basePrediction, result: { ...neutralResult, winner: 'piastri', podium: ['piastri', 'norris', 'russell'] }, expect: { winner: 0, podiumP2: 0, podiumBonus: 2, total: 2 } },
  { name: 'DNF und DNS richtig getippt', prediction: { ...basePrediction, dnf: 'alonso', dns: 'stroll' }, result: { ...neutralResult, winner: 'russell', podium: ['russell', 'hamilton', 'sainz'], dnf: ['gasly', 'alonso'], dns: ['stroll'] }, expect: { dnf: 3, dns: 5, perfectRound: 0, total: 8 } },
  { name: 'DNF-Tipp zählt nicht, wenn der Fahrer DNS ist', prediction: { ...basePrediction, dnf: 'stroll' }, result: { ...neutralResult, winner: 'russell', podium: ['russell', 'hamilton', 'sainz'], dnf: [], dns: ['stroll'] }, expect: { dnf: 0, dns: 0, total: 0 } },
];

for (const c of legacyCases) {
  test(`test-scoring.html: ${c.name}`, () => {
    const score = scoreRace(c.prediction, c.result, race);
    for (const [key, value] of Object.entries(c.expect)) {
      assert.equal(key === 'total' ? score.total : score.breakdown[key], value, key);
    }
  });
}

// ── Further rules ──
test('perfect round: all six categories right gives 21 points', () => {
  const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren' };
  const s = scoreRace(basePrediction, result, race);
  assert.equal(s.isPerfect, true);
  assert.equal(s.breakdown.perfectRound, 5);
  assert.equal(s.total, 21);
  assert.equal(s.max, 21);
});

test('perfect round plus DNF/DNS gives the 29-point maximum', () => {
  const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren', dnf: ['ocon'], dns: ['perez'] };
  const s = scoreRace({ ...basePrediction, dnf: 'ocon', dns: 'perez' }, result, race);
  assert.equal(s.total, 29);
  assert.equal(s.max, 29);
});

test('late race tip scores 0 and is flagged', () => {
  const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren' };
  const s = scoreRace({ ...basePrediction, submittedAt: '2026-06-01T12:00:01Z' }, result, race);
  assert.equal(s.total, 0);
  assert.equal(s.late, true);
});

test('tip exactly at the deadline is not late', () => {
  assert.equal(isLate('2026-06-01T12:00:00Z', '2026-06-01T12:00:00Z'), false);
  assert.equal(isLate(null, '2026-06-01T12:00:00Z'), false);
});

test('sprint: perfect sprint is 3+1+1+2 = 7', () => {
  const s = scoreSprint({ winner: 'a', podium: ['a', 'b', 'c'], submittedAt: '2026-01-01T00:00:00Z' }, { winner: 'a', podium: ['a', 'b', 'c'] }, { sprintStartUTC: '2026-01-02T00:00:00Z' });
  assert.equal(s.total, 7);
  assert.equal(s.isPerfect, true);
});

test('sprint: podium bonus 1 per driver on the podium in the wrong spot', () => {
  const s = scoreSprint({ winner: 'a', podium: ['a', 'b', 'c'] }, { winner: 'c', podium: ['c', 'a', 'b'] }, {});
  assert.equal(s.breakdown.sprintPodiumBonus, 3);
  assert.equal(s.total, 3);
});

test('sprint: late tip scores 0', () => {
  const s = scoreSprint({ winner: 'a', podium: ['a', 'b', 'c'], submittedAt: '2026-01-03T00:00:00Z' }, { winner: 'a', podium: ['a', 'b', 'c'] }, { sprintStartUTC: '2026-01-02T00:00:00Z' });
  assert.equal(s.total, 0);
  assert.equal(s.late, true);
});

test('season tip: WDC 20, WCC 15, nothing before the season is decided', () => {
  assert.equal(scoreSeason({ wdc: 'norris', wcc: 'mclaren' }, { wdc: 'norris', wcc: 'mclaren' }).total, 35);
  assert.equal(scoreSeason({ wdc: 'norris', wcc: 'ferrari' }, { wdc: 'norris', wcc: 'mclaren' }).total, 20);
  assert.equal(scoreSeason({ wdc: 'norris', wcc: 'mclaren' }, null).total, 0);
});

test('standings tiebreak: correct winners, then perfect rounds, then poles', () => {
  const races = [{ round: 1, raceStartUTC: '2026-03-08T05:00:00Z' }, { round: 2, raceStartUTC: '2026-03-15T05:00:00Z' }];
  const res = { winner: 'w', podium: ['w', 'x', 'y'], pole: 'p', fastestLap: 'f', bestConstructor: 't' };
  // A: winner right in round 1 (3). B: pole right in round 1 (3). Same points, A wins on correct winners.
  const game = {
    players: [{ id: 'b' }, { id: 'a' }], races,
    raceTips: { 1: { a: { winner: 'w', podium: ['w'] }, b: { winner: 'z', podium: ['z'], pole: 'p' } } },
    raceResults: { 1: res },
  };
  const st = calculateStandings(game);
  assert.deepEqual(st.map((s) => s.playerId), ['a', 'b']);
  assert.equal(st[0].totalPoints, st[1].totalPoints);
});

test('standings uptoRound only counts rounds up to that round', () => {
  const races = [{ round: 1, raceStartUTC: '2026-03-08T05:00:00Z' }, { round: 2, raceStartUTC: '2026-03-15T05:00:00Z' }];
  const res = { winner: 'w', podium: ['w', 'x', 'y'], pole: 'p', fastestLap: 'f', bestConstructor: 't' };
  const game = { players: [{ id: 'a' }], races, raceTips: { 1: { a: { winner: 'w' } }, 2: { a: { winner: 'w' } } }, raceResults: { 1: res, 2: res } };
  assert.equal(calculateStandings(game, { uptoRound: 1 })[0].totalPoints, 3);
  assert.equal(calculateStandings(game)[0].totalPoints, 6);
});

test('accuracy uses 21/29 per race and 7 per sprint', () => {
  assert.equal(accuracy({ raceScores: { 1: { total: 21, max: 21 } }, sprintScores: { 1: { total: 0 } } }), 75);
  assert.equal(accuracy({ raceScores: {}, sprintScores: {} }), 0);
});
