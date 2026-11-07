import { describe, expect, it } from 'vitest';
import { nextDeadline, nextRace, redact, weekendStatus } from '../../src/lib/domain/schedule';
import { validateRaceResult, validateRaceTip, validateSeasonTip, validateSprintTip } from '../../src/lib/domain/validate';
import seasonJson from '../../src/lib/domain/season.json';
import type { GameData, RaceTip, Season } from '../../src/lib/domain/types';

const season = seasonJson as Season;
const brazil = season.races.find((r) => r.round === 20)!;
const tip = (at: string): RaceTip => ({ podium: ['norris', 'piastri', 'leclerc'], pole: null, fastestLap: null, bestConstructor: null, dnf: null, dns: null, submittedAt: at });

describe('schedule', () => {
  const now = new Date('2026-11-07T12:00:00Z');

  it('finds the next race and its deadline', () => {
    expect(nextRace(season, now)?.round).toBe(20);
    expect(nextDeadline(season, now)).toMatchObject({ kind: 'race', at: brazil.raceStartUTC });
  });

  it('sprint deadline comes first on sprint weekends', () => {
    const singapore = season.races.find((r) => r.round === 17)!;
    const d = nextDeadline(season, new Date('2026-10-09T12:00:00Z'));
    expect(d).toMatchObject({ kind: 'sprint', at: singapore.sprintStartUTC });
  });

  it('weekend status walks open → live → awaiting → finished', () => {
    const data = { raceResults: {} as GameData['raceResults'] };
    const at = (iso: string) => weekendStatus(brazil, data, new Date(iso), nextRace(season, new Date(iso)));
    expect(at('2026-11-07T12:00:00Z')).toBe('open');
    expect(at('2026-11-08T18:00:00Z')).toBe('live');
    expect(at('2026-11-09T08:00:00Z')).toBe('awaiting');
    expect(weekendStatus(season.races[22], data, now, nextRace(season, now))).toBe('upcoming');
  });
});

describe('redact', () => {
  const data: GameData = {
    raceTips: { '19': { thomas: tip('2026-10-30T00:00:00Z') }, '20': { thomas: tip('2026-11-06T00:00:00Z'), viktor: tip('2026-11-06T00:00:00Z') } },
    sprintTips: {}, seasonTips: { julia: { wdc: 'norris', wcc: 'mclaren', submittedAt: '2026-02-01T00:00:00Z' } },
    raceResults: {}, sprintResults: {},
  };
  const now = new Date('2026-11-07T12:00:00Z');

  it("hides other players' tips while the deadline is open, but not the viewer's own", () => {
    const v = redact(season, data, 'viktor', now);
    expect(v.raceTips['20'].thomas).toEqual({ hidden: true, submittedAt: '2026-11-06T00:00:00Z' });
    expect(v.raceTips['20'].viktor).toEqual(data.raceTips['20'].viktor);
    expect(v.raceTips['19'].thomas).toEqual(data.raceTips['19'].thomas);
    expect(JSON.stringify(v.raceTips['20'].thomas)).not.toContain('norris');
  });

  it('anonymous viewers see nothing open', () => {
    const v = redact(season, data, null, now);
    expect(v.raceTips['20'].viktor).toMatchObject({ hidden: true });
  });

  it('reveals at the deadline', () => {
    const v = redact(season, data, null, new Date(brazil.raceStartUTC));
    expect(v.raceTips['20'].thomas).toEqual(data.raceTips['20'].thomas);
  });

  it('season tips are public after round 1', () => {
    expect(redact(season, data, null, now).seasonTips.julia).toEqual(data.seasonTips.julia);
    expect(redact(season, data, null, new Date('2026-01-01T00:00:00Z')).seasonTips.julia).toMatchObject({ hidden: true });
  });
});

describe('validate', () => {
  const at = '2026-11-07T12:00:00Z';
  it('accepts a full race tip and drops DNF/DNS before rules.dnfFromRound', () => {
    const v = validateRaceTip(season, 3, { podium: ['norris', 'piastri', 'leclerc'], pole: 'verstappen', dnf: 'alonso' }, at);
    expect(v.ok && v.value.dnf).toBe(null);
    const w = validateRaceTip(season, 20, { podium: ['norris', 'piastri', 'leclerc'], dnf: 'alonso', dns: '' }, at);
    expect(w.ok && w.value.dnf).toBe('alonso');
  });
  it('rejects duplicates, unknown ids, missing winner and DNF = DNS', () => {
    expect(validateRaceTip(season, 20, { podium: ['norris', 'norris', 'leclerc'] }, at).ok).toBe(false);
    expect(validateRaceTip(season, 20, { podium: ['schumacher', '', ''] }, at).ok).toBe(false);
    expect(validateRaceTip(season, 20, { podium: ['', 'norris', ''] }, at).ok).toBe(false);
    expect(validateRaceTip(season, 20, { podium: ['norris'], dnf: 'alonso', dns: 'alonso' }, at).ok).toBe(false);
    expect(validateRaceTip(season, 20, { podium: ['norris'], bestConstructor: 'brawn' }, at).ok).toBe(false);
  });
  it('sprint and season tips', () => {
    expect(validateSprintTip(season, { podium: ['norris', 'piastri', ''] }, at).ok).toBe(true);
    expect(validateSeasonTip(season, { wdc: 'norris' }, at).ok).toBe(false);
    expect(validateSeasonTip(season, { wdc: 'norris', wcc: 'mclaren' }, at).ok).toBe(true);
  });
  it('race results need a complete podium and the key fields; DNF lists only from dnfFromRound', () => {
    const base = { podium: ['norris', 'piastri', 'leclerc'], pole: 'norris', fastestLap: 'piastri', bestConstructor: 'mclaren' };
    expect(validateRaceResult(season, 20, { ...base, podium: ['norris', 'piastri', ''] }, at).ok).toBe(false);
    const ok = validateRaceResult(season, 20, { ...base, dnfList: ['alonso', 'alonso'], dnsList: [] }, at);
    expect(ok.ok && ok.value.dnf).toEqual(['alonso']);
    const early = validateRaceResult(season, 3, { ...base, dnfList: ['alonso'] }, at);
    expect(early.ok && early.value.dnf).toBe(null);
    expect(validateRaceResult(season, 20, { ...base, dnfList: ['alonso'], dnsList: ['alonso'] }, at).ok).toBe(false);
  });
});
