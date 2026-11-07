import { describe, expect, it } from 'vitest';
import { calculateStandings, pointsProgression, scoreRace, scoreSeason, scoreSprint } from '../../src/lib/domain/scoring';
import type { Race, RaceResult, RaceTip, Season } from '../../src/lib/domain/types';
import seasonJson from '../../src/lib/domain/season.json';

const race = { round: 18, raceStartUTC: '2026-06-01T12:00:00Z', sprintStartUTC: '2026-05-31T12:00:00Z', sprint: true } as Race;

const tip = (o: Partial<RaceTip> = {}): RaceTip => ({
  podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren',
  dnf: null, dns: null, submittedAt: '2026-06-01T11:00:00Z', ...o,
});
const result = (podium: [string, string, string], o: Partial<RaceResult> = {}): RaceResult => ({
  podium, pole: 'russell', fastestLap: 'sainz', bestConstructor: 'ferrari', dnf: null, dns: null, topTen: null, enteredAt: '', ...o,
});

// The scenarios of the legacy test-scoring.html, unchanged.
describe('scoreRace – legacy regression scenarios', () => {
  const cases: Array<[string, RaceTip, RaceResult, Record<string, number>]> = [
    ['P1 exakt gibt keinen Bonus', tip(), result(['norris', 'russell', 'hamilton']), { winner: 3, podiumBonus: 0, total: 3 }],
    ['Getippter Sieger endet auf P2', tip(), result(['russell', 'norris', 'hamilton']), { winner: 0, podiumBonus: 1, total: 1 }],
    ['Getippter Sieger endet auf P3', tip(), result(['russell', 'hamilton', 'norris']), { winner: 0, podiumBonus: 1, total: 1 }],
    ['Getippter P2 endet auf P1', tip(), result(['piastri', 'hamilton', 'russell']), { podiumP2: 0, podiumBonus: 1, total: 1 }],
    ['Getippter P3 endet auf P1', tip(), result(['leclerc', 'hamilton', 'russell']), { podiumP3: 0, podiumBonus: 1, total: 1 }],
    ['P1↔P2-Tausch zählt beide Boni', tip(), result(['piastri', 'norris', 'russell']), { winner: 0, podiumP2: 0, podiumBonus: 2, total: 2 }],
    ['DNF und DNS richtig', tip({ dnf: 'alonso', dns: 'stroll' }), result(['russell', 'hamilton', 'sainz'], { dnf: ['gasly', 'alonso'], dns: ['stroll'] }), { dnf: 3, dns: 5, perfectRound: 0, total: 8 }],
    ['DNF-Tipp zählt nicht, wenn Fahrer DNS ist', tip({ dnf: 'stroll' }), result(['russell', 'hamilton', 'sainz'], { dnf: [], dns: ['stroll'] }), { dnf: 0, dns: 0, total: 0 }],
  ];
  for (const [name, t, r, exp] of cases) {
    it(name, () => {
      const s = scoreRace(t, r, race);
      for (const [k, v] of Object.entries(exp)) expect(k === 'total' ? s.total : s.breakdown[k as keyof typeof s.breakdown]).toBe(v);
    });
  }
});

describe('scoreRace', () => {
  it('perfect round = 21 and +8 with DNF/DNS', () => {
    const perfect = result(['norris', 'piastri', 'leclerc'], { pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren' });
    expect(scoreRace(tip(), perfect, race)).toMatchObject({ total: 21, isPerfect: true, max: 21 });
    const withLists = { ...perfect, dnf: ['alonso'], dns: ['stroll'] };
    expect(scoreRace(tip({ dnf: 'alonso', dns: 'stroll' }), withLists, race)).toMatchObject({ total: 29, max: 29 });
  });

  it('late tip scores 0 and is flagged', () => {
    const s = scoreRace(tip({ submittedAt: '2026-06-01T12:00:01Z' }), result(['norris', 'piastri', 'leclerc']), race);
    expect(s).toMatchObject({ total: 0, late: true });
  });

  it('a blank pick never matches a blank result field', () => {
    const s = scoreRace(tip({ pole: null }), result(['x', 'y', 'z'], { pole: null }), race);
    expect(s.breakdown.pole).toBe(0);
  });
});

describe('scoreSprint', () => {
  it('perfect sprint = 7', () => {
    const s = scoreSprint({ podium: ['a', 'b', 'c'], submittedAt: '2026-05-31T11:00:00Z' }, { podium: ['a', 'b', 'c'], enteredAt: '' }, race);
    expect(s).toMatchObject({ total: 7, isPerfect: true });
  });
  it('rotated podium = 3 bonus points', () => {
    const s = scoreSprint({ podium: ['a', 'b', 'c'], submittedAt: '2026-05-31T11:00:00Z' }, { podium: ['c', 'a', 'b'], enteredAt: '' }, race);
    expect(s.total).toBe(3);
  });
  it('uses the sprint deadline for lateness', () => {
    const s = scoreSprint({ podium: ['a', 'b', 'c'], submittedAt: '2026-05-31T12:30:00Z' }, { podium: ['a', 'b', 'c'], enteredAt: '' }, race);
    expect(s.late).toBe(true);
  });
});

describe('season + standings', () => {
  const season = { ...(seasonJson as Season) };

  it('season tips score only once final is set', () => {
    const t = { wdc: 'norris', wcc: 'mclaren', submittedAt: '' };
    expect(scoreSeason(t, null).total).toBe(0);
    expect(scoreSeason(t, { wdc: 'norris', wcc: 'ferrari' }).total).toBe(20);
    expect(scoreSeason(t, { wdc: 'norris', wcc: 'mclaren' }).total).toBe(35);
  });

  it('ranks by points then tiebreakers and shares rank on a full tie', () => {
    const r1 = season.races[0];
    const res = result(['norris', 'piastri', 'leclerc'], { pole: 'verstappen' });
    const data = {
      raceTips: {
        '1': {
          thomas: tip({ submittedAt: '2026-01-01T00:00:00Z', podium: ['piastri', 'norris', 'x'], pole: 'verstappen' }), // 1+1+3 = 5
          julia: tip({ submittedAt: '2026-01-01T00:00:00Z', podium: ['norris', 'x', 'y'], pole: null, fastestLap: null, bestConstructor: null }), // 3
          viktor: tip({ submittedAt: '2026-01-01T00:00:00Z', podium: ['norris', 'x', 'y'], pole: null, fastestLap: null, bestConstructor: null }),
        },
      },
      sprintTips: {}, seasonTips: {}, raceResults: { '1': res }, sprintResults: {},
    };
    const st = calculateStandings(season, data);
    expect(st.map((s) => [s.playerId, s.totalPoints, s.rank])).toEqual([
      ['thomas', 5, 1], ['julia', 3, 2], ['viktor', 3, 2],
    ]);
    expect(r1.round).toBe(1);
    const prog = pointsProgression(season, st, data);
    expect(prog.rounds).toEqual([1]);
    expect(prog.series[0].points).toEqual([5]);
  });

  it('on equal points, more correct winners ranks higher', () => {
    const res = result(['a', 'b', 'c'], { pole: 'p', fastestLap: 'f', bestConstructor: 'mclaren' });
    const t = (podium: [string, string, string], pole: string | null) =>
      tip({ submittedAt: '2026-01-01T00:00:00Z', podium, pole, fastestLap: null, bestConstructor: null });
    const data = {
      raceTips: { '1': {
        thomas: t(['b', 'a', 'z'], 'p'), // bonus 1 + bonus 1 + pole 3 = 5, no winner
        viktor: t(['a', 'z', 'c'], null), // winner 3 + P3 2 = 5, winner right
        julia: t(['a', 'z', 'y'], null), // 3
      } },
      sprintTips: {}, seasonTips: {}, raceResults: { '1': res }, sprintResults: {},
    };
    const st = calculateStandings(season, data);
    expect(st.map((s) => [s.playerId, s.totalPoints, s.rank])).toEqual([['viktor', 5, 1], ['thomas', 5, 2], ['julia', 3, 3]]);
  });
});
