import { describe, expect, it } from 'vitest';
import { openDb } from '../src/lib/server/db';
import { importLegacyRows, importSeason, legacyDataToRows } from '../src/lib/server/db/import';
import { demoData, seasonFile } from '../src/lib/server/db/seed';
import { loadSeason } from '../src/lib/server/season';
import { deleteRaceResult, saveChampions, saveRaceResult, saveSeasonTip, saveSprintResult } from '../src/lib/server/results';
import { saveRaceTip } from '../src/lib/server/tips';
import { requireAdmin } from '../src/lib/server/guard';
import { calculateStandings } from '../src/lib/scoring';

async function demoDb() {
  const db = await openDb();
  const season = seasonFile();
  await importSeason(db, season);
  await importLegacyRows(db, season.season, legacyDataToRows(demoData()));
  return { db, year: season.season, load: () => loadSeason(db, season.season) };
}

const SEASON_END = new Date('2026-12-31T00:00:00Z');
const result = { winner: 'norris', p2: 'piastri', p3: 'leclerc', pole: 'norris', fastestLap: 'piastri', bestConstructor: 'mclaren', dnf: ['stroll'], dns: [] as string[] };

describe('race results', () => {
  it('before round 16 no DNF/DNS lists are stored (max stays 21), from round 16 they are (max 29)', async () => {
    const { db, load } = await demoDb();
    let data = await load();
    expect(await saveRaceResult(db, data, 5, result, SEASON_END)).toEqual({ ok: true });
    expect(await saveRaceResult(db, data, 16, result, SEASON_END)).toEqual({ ok: true });
    data = await load();
    expect(data.game.raceResults[5].dnf).toBeUndefined();
    expect(data.game.raceResults[16].dnf).toEqual(['stroll']);
    expect(data.game.raceResults[16].dns).toEqual([]);
  });

  it('entering a result updates the standings, deleting it reverts them', async () => {
    const { db, load } = await demoDb();
    const before = calculateStandings((await load()).game);
    // a tip for round 20 by Thomas, then the result
    const data = await load();
    const tipTime = new Date(new Date(data.races[19].raceStartUTC).getTime() - 3600_000);
    await saveRaceTip(db, data, 'thomas', 20, { winner: 'norris', p2: 'piastri', p3: 'leclerc', pole: 'norris', fastestLap: 'piastri', bestConstructor: 'mclaren', dnf: 'stroll', dns: '' }, tipTime);
    await saveRaceResult(db, await load(), 20, result, SEASON_END);
    const after = calculateStandings((await load()).game);
    const thomas = (st: typeof after) => st.find(s => s.playerId === 'thomas')!;
    expect(thomas(after).totalPoints - thomas(before).totalPoints).toBe(21 + 3); // perfect round + DNF
    await deleteRaceResult(db, data.year, 20);
    expect(thomas(calculateStandings((await load()).game)).totalPoints).toBe(thomas(before).totalPoints);
  });

  it('validates results', async () => {
    const { db, load } = await demoDb();
    const data = await load();
    const bad = (patch: Partial<typeof result>) => saveRaceResult(db, data, 20, { ...result, ...patch }, SEASON_END);
    expect(await bad({ p2: 'norris' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ pole: '' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ bestConstructor: 'brabham' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ dnf: ['alonso'], dns: ['alonso'] })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ dnf: ['norris'] })).toMatchObject({ ok: false, status: 400 });
    expect(await saveRaceResult(db, data, 99, result, SEASON_END)).toMatchObject({ ok: false, status: 400 });
    expect(await saveSprintResult(db, data, 20, { winner: 'norris', p2: 'piastri', p3: 'leclerc' }, SEASON_END)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('results only after the start (review F2)', () => {
  it('refuses race and sprint results before the start, accepts them afterwards', async () => {
    const { db, load } = await demoDb();
    const data = await load();
    const r20 = data.races.find(r => r.round === 20)!;
    const start = new Date(r20.raceStartUTC);
    expect(await saveRaceResult(db, data, 20, result, new Date(start.getTime() - 1000))).toMatchObject({ ok: false, status: 403 });
    expect((await load()).game.raceResults[20]).toBeUndefined();
    expect(await saveRaceResult(db, data, 20, result, start)).toEqual({ ok: true });

    const sprintRace = data.races.find(r => r.sprint && r.sprintStartUTC)!;
    const sStart = new Date(sprintRace.sprintStartUTC!);
    const podium = { winner: 'norris', p2: 'piastri', p3: 'leclerc' };
    expect(await saveSprintResult(db, data, sprintRace.round, podium, new Date(sStart.getTime() - 1000))).toMatchObject({ ok: false, status: 403 });
    expect(await saveSprintResult(db, data, sprintRace.round, podium, sStart)).toEqual({ ok: true });
  });
});

describe('season end and season tips', () => {
  it('champions add 20/15 season points', async () => {
    const { db, load } = await demoDb();
    const data = await load();
    const before = calculateStandings(data.game);
    const tip = data.game.seasonTips.thomas!;
    expect(await saveChampions(db, data, tip.wdc!, tip.wcc!)).toEqual({ ok: true });
    const after = calculateStandings((await load()).game);
    const t = (st: typeof after) => st.find(s => s.playerId === 'thomas')!;
    expect(t(after).seasonPoints).toBe(35);
    expect(t(after).totalPoints).toBe(t(before).totalPoints + 35);
    expect(await saveChampions(db, data, tip.wdc!, '')).toMatchObject({ ok: false });
    expect(await saveChampions(db, data, '', '')).toEqual({ ok: true });
    expect((await load()).game.final).toBeNull();
  });

  it('season tips close at the start of round 1', async () => {
    const { db, load } = await demoDb();
    const data = await load();
    const start = new Date(data.races[0].raceStartUTC);
    expect(await saveSeasonTip(db, data, 'julia', 'russell', 'mercedes', new Date(start.getTime() - 1000))).toEqual({ ok: true });
    expect(await saveSeasonTip(db, data, 'julia', 'russell', 'mercedes', start)).toMatchObject({ ok: false, status: 403 });
    expect(await saveSeasonTip(db, data, 'julia', 'nobody', 'mercedes', new Date(start.getTime() - 1000))).toMatchObject({ ok: false, status: 400 });
  });
});

describe('admin guard', () => {
  it('rejects anonymous and non-admin players', () => {
    expect(() => requireAdmin({ player: null })).toThrow();
    expect(() => requireAdmin({ player: { id: 'julia', name: 'Julia', isAdmin: false } })).toThrow();
    expect(requireAdmin({ player: { id: 'viktor', name: 'Viktor', isAdmin: true } }).id).toBe('viktor');
  });
});
