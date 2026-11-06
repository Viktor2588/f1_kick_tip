import { describe, expect, it } from 'vitest';
import { scoreRace, scoreSprint, scoreSeason } from './scoring';
import { computeStandings, rankHistory } from './standings';
import type { RaceResult, RaceTip, Season, Snapshot } from './types';
import { emptySnapshot } from './types';

const race = { raceStartUTC: '2026-06-01T12:00:00Z', sprintStartUTC: '2026-05-31T12:00:00Z' };
const tip: RaceTip = {
  p1: 'norris', p2: 'piastri', p3: 'leclerc',
  pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren',
  submittedAt: '2026-06-01T11:00:00Z',
};
const neutral = { pole: 'russell', fastestLap: 'sainz', bestConstructor: 'ferrari', enteredAt: '2026-06-02T08:00:00Z' };
const res = (p1: string, p2: string, p3: string, extra: Partial<RaceResult> = {}): RaceResult => ({ ...neutral, p1, p2, p3, ...extra });

// Ported 1:1 from the legacy test-scoring.html regression page.
describe('race scoring (legacy regression cases)', () => {
  it('P1 exakt gibt keinen Bonus', () => {
    const s = scoreRace(tip, res('norris', 'russell', 'hamilton'), race);
    expect([s.breakdown.p1, s.breakdown.podiumBonus, s.total]).toEqual([3, 0, 3]);
  });
  it('Getippter Sieger endet auf P2', () => {
    const s = scoreRace(tip, res('russell', 'norris', 'hamilton'), race);
    expect([s.breakdown.p1, s.breakdown.podiumBonus, s.total]).toEqual([0, 1, 1]);
  });
  it('Getippter Sieger endet auf P3', () => {
    const s = scoreRace(tip, res('russell', 'hamilton', 'norris'), race);
    expect([s.breakdown.p1, s.breakdown.podiumBonus, s.total]).toEqual([0, 1, 1]);
  });
  it('Getippter P2 endet auf P1', () => {
    const s = scoreRace(tip, res('piastri', 'hamilton', 'russell'), race);
    expect([s.breakdown.p2, s.breakdown.podiumBonus, s.total]).toEqual([0, 1, 1]);
  });
  it('Getippter P3 endet auf P1', () => {
    const s = scoreRace(tip, res('leclerc', 'hamilton', 'russell'), race);
    expect([s.breakdown.p3, s.breakdown.podiumBonus, s.total]).toEqual([0, 1, 1]);
  });
  it('Kombinierter P1↔P2-Tausch zählt beide Boni', () => {
    const s = scoreRace(tip, res('piastri', 'norris', 'russell'), race);
    expect([s.breakdown.p1, s.breakdown.p2, s.breakdown.podiumBonus, s.total]).toEqual([0, 0, 2, 2]);
  });
  it('DNF und DNS richtig getippt', () => {
    const s = scoreRace({ ...tip, dnf: 'alonso', dns: 'stroll' }, res('russell', 'hamilton', 'sainz', { dnf: ['gasly', 'alonso'], dns: ['stroll'] }), race);
    expect([s.breakdown.dnf, s.breakdown.dns, s.breakdown.perfect, s.total]).toEqual([3, 5, 0, 8]);
  });
  it('DNF-Tipp zählt nicht, wenn der Fahrer DNS ist', () => {
    const s = scoreRace({ ...tip, dnf: 'stroll' }, res('russell', 'hamilton', 'sainz', { dnf: [], dns: ['stroll'] }), race);
    expect([s.breakdown.dnf, s.breakdown.dns, s.total]).toEqual([0, 0, 0]);
  });
});

describe('race scoring', () => {
  const perfectResult = res('norris', 'piastri', 'leclerc', { pole: 'verstappen', fastestLap: 'hamilton', bestConstructor: 'mclaren' });

  it('perfect round = 21 and max 21 without DNF lists', () => {
    const s = scoreRace(tip, perfectResult, race);
    expect(s.total).toBe(21);
    expect(s.perfect).toBe(true);
    expect(s.max).toBe(21);
  });
  it('max is 29 when the result has DNF/DNS lists', () => {
    expect(scoreRace(tip, { ...perfectResult, dnf: [], dns: [] }, race).max).toBe(29);
  });
  it('perfect round plus DNF/DNS = 29', () => {
    const s = scoreRace({ ...tip, dnf: 'gasly', dns: 'ocon' }, { ...perfectResult, dnf: ['gasly'], dns: ['ocon'] }, race);
    expect(s.total).toBe(29);
  });
  it('late tip scores 0 and is flagged', () => {
    const s = scoreRace({ ...tip, submittedAt: '2026-06-01T12:00:01Z' }, perfectResult, race);
    expect(s.total).toBe(0);
    expect(s.late).toBe(true);
  });
  it('tip exactly at the deadline still counts', () => {
    expect(scoreRace({ ...tip, submittedAt: '2026-06-01T12:00:00Z' }, perfectResult, race).total).toBe(21);
  });
  it('empty tip fields never match empty result fields', () => {
    const blank = { ...tip, pole: '', fastestLap: '' };
    const s = scoreRace(blank, { ...perfectResult, pole: '', fastestLap: '' }, race);
    expect(s.breakdown.pole + s.breakdown.fastestLap).toBe(0);
  });
  it('full podium in the wrong order = 3 bonus points', () => {
    expect(scoreRace(tip, res('leclerc', 'norris', 'piastri'), race).breakdown.podiumBonus).toBe(3);
  });
});

describe('sprint scoring', () => {
  const sTip = { p1: 'norris', p2: 'piastri', p3: 'leclerc', submittedAt: '2026-05-31T11:00:00Z' };
  it('perfect sprint = 7', () => {
    const s = scoreSprint(sTip, { p1: 'norris', p2: 'piastri', p3: 'leclerc', enteredAt: '' }, race);
    expect([s.total, s.perfect]).toEqual([7, true]);
  });
  it('podium in wrong order = 3 bonus', () => {
    expect(scoreSprint(sTip, { p1: 'piastri', p2: 'leclerc', p3: 'norris', enteredAt: '' }, race).total).toBe(3);
  });
  it('late sprint tip = 0', () => {
    expect(scoreSprint({ ...sTip, submittedAt: '2026-05-31T13:00:00Z' }, { p1: 'norris', p2: 'piastri', p3: 'leclerc', enteredAt: '' }, race).late).toBe(true);
  });
});

describe('season scoring', () => {
  it('WDC 20 + WCC 15', () => {
    expect(scoreSeason({ wdc: 'norris', wcc: 'mclaren', submittedAt: '' }, { wdc: 'norris', wcc: 'mclaren' }).total).toBe(35);
  });
  it('unresolved season = 0', () => {
    expect(scoreSeason({ wdc: 'norris', wcc: 'mclaren', submittedAt: '' }, null).total).toBe(0);
  });
});

describe('standings', () => {
  const season = {
    season: 2026,
    players: [
      { id: 'a', name: 'A', emoji: '', color: '' },
      { id: 'b', name: 'B', emoji: '', color: '' },
      { id: 'c', name: 'C', emoji: '', color: '' },
    ],
    teams: [], drivers: [],
    races: [
      { round: 1, raceStartUTC: '2026-03-01T12:00:00Z', sprint: false, sprintStartUTC: null },
      { round: 2, raceStartUTC: '2026-03-08T12:00:00Z', sprint: true, sprintStartUTC: '2026-03-07T12:00:00Z' },
    ],
  } as unknown as Season;

  const snap: Snapshot = emptySnapshot();
  const r1 = res('norris', 'piastri', 'leclerc');
  snap.raceResults['1'] = r1;
  snap.raceResults['2'] = r1;
  snap.sprintResults['2'] = { p1: 'norris', p2: 'piastri', p3: 'leclerc', enteredAt: '' };
  // a: correct winner twice (6). b: P2+P3 exact once + pole... b gets 3+3 via pole? keep simple:
  snap.raceTips['1'] = {
    a: { ...tip, p2: 'x', p3: 'y', pole: 'x', fastestLap: 'x', bestConstructor: 'x', submittedAt: '2026-03-01T00:00:00Z' }, // 3
    b: { ...tip, p1: 'x', p3: 'y', pole: 'russell', fastestLap: 'x', bestConstructor: 'x', submittedAt: '2026-03-01T00:00:00Z' }, // p2 2 + pole 3 = 5
  };
  snap.raceTips['2'] = {
    a: { ...tip, p2: 'x', p3: 'y', pole: 'x', fastestLap: 'x', bestConstructor: 'x', submittedAt: '2026-03-08T00:00:00Z' }, // 3
    b: { ...tip, p1: 'x', p2: 'x', p3: 'y', pole: 'x', fastestLap: 'x', bestConstructor: 'x', submittedAt: '2026-03-08T00:00:00Z' }, // 0
  };
  snap.sprintTips['2'] = { b: { p1: 'piastri', p2: 'x', p3: 'x', submittedAt: '2026-03-07T00:00:00Z' } }; // bonus 1

  const st = computeStandings(season, snap);

  it('sums race and sprint points', () => {
    const a = st.find((s) => s.playerId === 'a')!;
    const b = st.find((s) => s.playerId === 'b')!;
    expect([a.total, b.total]).toEqual([6, 6]);
    expect(b.sprintPoints).toBe(1);
  });
  it('breaks ties by correct winners first', () => {
    expect(st.map((s) => s.playerId)).toEqual(['a', 'b', 'c']);
    expect(st.map((s) => s.rank)).toEqual([1, 2, 3]);
  });
  it('tracks cumulative points per round and missed tips', () => {
    const b = st.find((s) => s.playerId === 'b')!;
    expect(b.perRound).toEqual([{ round: 1, points: 5, cumulative: 5 }, { round: 2, points: 1, cumulative: 6 }]);
    expect(st.find((s) => s.playerId === 'c')!.missedTips).toBe(2);
  });
  it('rank history by points', () => {
    expect(rankHistory(st)).toEqual({ a: [2, 1], b: [1, 1], c: [3, 3] });
  });
});
