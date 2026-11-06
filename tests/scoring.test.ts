// Ported from legacy/test-scoring.html: the regression cases for the podium bonus and DNF/DNS rules.
import { describe, expect, it } from 'vitest';
import { scoreRace, scoreSprint, scoreSeasonTip, calculateAccuracy, calculateStandings, type RaceTip, type RaceResult } from '../src/lib/scoring';

const race = { raceStartUTC: '2026-06-01T12:00:00Z' };
const baseTip: RaceTip = {
  winner: 'norris',
  podium: ['norris', 'piastri', 'leclerc'],
  pole: 'verstappen',
  fastestLap: 'hamilton',
  bestConstructor: 'mclaren',
  submittedAt: '2026-06-01T11:00:00Z',
};
const neutral = { pole: 'russell', fastestLap: 'sainz', bestConstructor: 'ferrari' };

const cases: { name: string; tip: RaceTip; result: RaceResult; expect: Record<string, number> }[] = [
  { name: 'P1 exakt gibt keinen Bonus', tip: baseTip,
    result: { ...neutral, winner: 'norris', podium: ['norris', 'russell', 'hamilton'] },
    expect: { winner: 3, podiumBonus: 0, total: 3 } },
  { name: 'Getippter Sieger endet auf P2', tip: baseTip,
    result: { ...neutral, winner: 'russell', podium: ['russell', 'norris', 'hamilton'] },
    expect: { winner: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter Sieger endet auf P3', tip: baseTip,
    result: { ...neutral, winner: 'russell', podium: ['russell', 'hamilton', 'norris'] },
    expect: { winner: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter P2 endet auf P1', tip: baseTip,
    result: { ...neutral, winner: 'piastri', podium: ['piastri', 'hamilton', 'russell'] },
    expect: { podiumP2: 0, podiumBonus: 1, total: 1 } },
  { name: 'Getippter P3 endet auf P1', tip: baseTip,
    result: { ...neutral, winner: 'leclerc', podium: ['leclerc', 'hamilton', 'russell'] },
    expect: { podiumP3: 0, podiumBonus: 1, total: 1 } },
  { name: 'Kombinierter P1↔P2-Tausch zählt beide Boni', tip: baseTip,
    result: { ...neutral, winner: 'piastri', podium: ['piastri', 'norris', 'russell'] },
    expect: { winner: 0, podiumP2: 0, podiumBonus: 2, total: 2 } },
  { name: 'DNF und DNS richtig getippt', tip: { ...baseTip, dnf: 'alonso', dns: 'stroll' },
    result: { ...neutral, winner: 'russell', podium: ['russell', 'hamilton', 'sainz'], dnf: ['gasly', 'alonso'], dns: ['stroll'] },
    expect: { dnf: 3, dns: 5, perfectRound: 0, total: 8 } },
  { name: 'DNF-Tipp zählt nicht, wenn der Fahrer DNS ist', tip: { ...baseTip, dnf: 'stroll' },
    result: { ...neutral, winner: 'russell', podium: ['russell', 'hamilton', 'sainz'], dnf: [], dns: ['stroll'] },
    expect: { dnf: 0, dns: 0, total: 0 } },
];

describe('race scoring (legacy test-scoring.html cases)', () => {
  for (const c of cases) {
    it(c.name, () => {
      const score = scoreRace(c.tip, c.result, race);
      for (const [key, value] of Object.entries(c.expect)) {
        if (key === 'total') expect(score.total).toBe(value);
        else expect(score.breakdown[key as keyof typeof score.breakdown]).toBe(value);
      }
    });
  }
});

describe('further rules', () => {
  it('perfect round gives 21 points', () => {
    const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren' };
    const score = scoreRace(baseTip, result, race);
    expect(score.isPerfect).toBe(true);
    expect(score.total).toBe(21);
    expect(score.max).toBe(21);
  });

  it('DNF/DNS lists raise the maximum to 29 and do not count for the perfect round', () => {
    const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren', dnf: ['alonso'], dns: [] };
    const score = scoreRace({ ...baseTip, dnf: 'alonso' }, result, race);
    expect(score.max).toBe(29);
    expect(score.total).toBe(24);
    expect(score.isPerfect).toBe(true);
  });

  it('late race tip scores 0', () => {
    const score = scoreRace({ ...baseTip, submittedAt: '2026-06-01T12:00:01Z' }, { ...neutral, winner: 'norris', podium: ['norris', 'x', 'y'] }, race);
    expect(score).toMatchObject({ total: 0, late: true });
  });

  it('tip exactly at the deadline is not late', () => {
    const score = scoreRace({ ...baseTip, submittedAt: '2026-06-01T12:00:00Z' }, { ...neutral, winner: 'norris', podium: ['norris', 'x', 'y'] }, race);
    expect(score.late).toBeUndefined();
    expect(score.total).toBe(3);
  });

  it('sprint: perfect sprint is 7, late sprint tip is 0', () => {
    const sprintRace = { raceStartUTC: '2026-06-01T12:00:00Z', sprintStartUTC: '2026-05-31T12:00:00Z' };
    const tip = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], submittedAt: '2026-05-31T11:00:00Z' };
    const result = { winner: 'norris', podium: ['norris', 'piastri', 'leclerc'] };
    expect(scoreSprint(tip, result, sprintRace).total).toBe(7);
    expect(scoreSprint({ ...tip, submittedAt: '2026-05-31T12:30:00Z' }, result, sprintRace)).toMatchObject({ total: 0, late: true });
    // swapped P1/P2: 1 (P3) + 2 bonus
    expect(scoreSprint({ ...tip, winner: 'piastri', podium: ['piastri', 'norris', 'leclerc'] }, result, sprintRace).total).toBe(3);
  });

  it('season tips: 20 for WDC, 15 for WCC, 0 before the season ends', () => {
    expect(scoreSeasonTip({ wdc: 'russell', wcc: 'mercedes' }, { wdc: 'russell', wcc: 'mercedes' }).total).toBe(35);
    expect(scoreSeasonTip({ wdc: 'russell', wcc: 'mclaren' }, { wdc: 'russell', wcc: 'mercedes' }).total).toBe(20);
    expect(scoreSeasonTip({ wdc: 'russell', wcc: 'mercedes' }, null).total).toBe(0);
  });

  it('accuracy is earned / possible in percent', () => {
    const r = scoreRace(baseTip, { ...neutral, winner: 'norris', podium: ['norris', 'x', 'y'] }, race);
    expect(calculateAccuracy({ 1: r }, {})).toBe(Math.round((3 / 21) * 100));
    expect(calculateAccuracy({}, {})).toBe(0);
  });
});

describe('standings tiebreakers', () => {
  // Results: race 1 and race 2. Players are listed b, a, c on purpose.
  const r1 = { winner: 'w1', podium: ['w1', 'a2', 'a3'], pole: 'p1', fastestLap: 'f1', bestConstructor: 'c1' };
  const r2 = { winner: 'w2', podium: ['w2', 'b2', 'b3'], pole: 'p2', fastestLap: 'f2', bestConstructor: 'c2' };
  const miss = { winner: 'z', podium: ['z', 'y', 'x'], pole: 'z', fastestLap: 'z', bestConstructor: 'zz' };
  // a: perfect round 1 (21), nothing in round 2 → 21 pts, 1 winner, 1 perfect, 1 pole
  const a = { 1: { ...r1 }, 2: miss };
  // b: round 1 winner+P2+pole+FL+constructor (14), round 2 pole+FL+1 bonus (7) → 21 pts, 1 winner, 0 perfect, 2 poles
  const b = { 1: { ...r1, podium: ['w1', 'a2', 'x'] }, 2: { winner: 'b2', podium: ['b2', 'z', 'y'], pole: 'p2', fastestLap: 'f2', bestConstructor: 'zz' } };
  const game = {
    players: [{ id: 'b' }, { id: 'a' }, { id: 'c' }],
    races: [{ round: 1, sprint: false, raceStartUTC: '2026-03-08T05:00:00Z' }, { round: 2, sprint: false, raceStartUTC: '2026-03-15T07:00:00Z' }],
    raceTips: { 1: { a: a[1], b: b[1], c: a[1] }, 2: { a: a[2], b: b[2], c: a[2] } },
    sprintTips: {}, seasonTips: {}, raceResults: { 1: r1, 2: r2 }, sprintResults: {}, final: null,
  };

  it('equal points and winners: perfect rounds beat correct poles; full tie keeps player order', () => {
    const st = calculateStandings(game);
    expect(st.map(s => [s.playerId, s.totalPoints, s.correctWinners, s.perfectRounds, s.correctPoles])).toEqual([
      ['a', 21, 1, 1, 1],
      ['c', 21, 1, 1, 1],
      ['b', 21, 1, 0, 2],
    ]);
  });

  it('equal points, winners and perfect rounds: more correct poles wins', () => {
    // d: like b but with a 3rd pole via a third race; e: 2 poles, same points
    const r3 = { winner: 'w3', podium: ['w3', 'c2', 'c3'], pole: 'p3', fastestLap: 'f3', bestConstructor: 'c3' };
    const g = {
      players: [{ id: 'e' }, { id: 'd' }],
      races: [{ round: 1, sprint: false, raceStartUTC: '2026-03-08T05:00:00Z' }, { round: 2, sprint: false, raceStartUTC: '2026-03-15T07:00:00Z' }],
      raceTips: { 1: { d: { ...miss, pole: 'p1' }, e: { ...miss, fastestLap: 'f1' } }, 2: { d: { ...miss, pole: 'p2' }, e: { ...miss, bestConstructor: 'c2' } } },
      sprintTips: {}, seasonTips: {}, raceResults: { 1: r1, 2: r2, 3: r3 }, sprintResults: {}, final: null,
    };
    expect(calculateStandings(g).map(s => [s.playerId, s.totalPoints, s.correctPoles])).toEqual([['d', 6, 2], ['e', 6, 0]]);
  });
});
