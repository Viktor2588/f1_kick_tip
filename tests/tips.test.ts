import { describe, expect, it } from 'vitest';
import { openDb } from '../src/lib/server/db';
import { importSeason } from '../src/lib/server/db/import';
import { seasonFile } from '../src/lib/server/db/seed';
import { loadSeason } from '../src/lib/server/season';
import { saveRaceTip, saveSprintTip } from '../src/lib/server/tips';
import { endSession, issueLoginToken, loginWithToken, playerForSession } from '../src/lib/server/auth';
import { raceView } from '../src/lib/server/views';
import { scoreRace } from '../src/lib/scoring';

async function fresh() {
  const db = await openDb();
  const season = seasonFile();
  await importSeason(db, season);
  return { db, season, data: await loadSeason(db, season.season) };
}

const tip = { winner: 'norris', p2: 'piastri', p3: 'leclerc', pole: 'norris', fastestLap: '', bestConstructor: 'mclaren', dnf: 'stroll', dns: '' };
const brazilStart = new Date(seasonFile().races.find(r => r.round === 20)!.raceStartUTC);
const beforeBrazil = new Date(brazilStart.getTime() - 86_400_000);
const afterBrazil = brazilStart; // exactly at the start is already too late

describe('personal login links', () => {
  it('link → session → player; new link invalidates the old one; logout ends the session', async () => {
    const { db } = await fresh();
    const first = await issueLoginToken(db, 'julia');
    const s1 = await loginWithToken(db, first);
    expect(s1?.playerId).toBe('julia');
    expect((await playerForSession(db, s1!.sessionToken))?.name).toBe('Julia');

    const second = await issueLoginToken(db, 'julia');
    expect(await loginWithToken(db, first)).toBeNull();
    expect((await loginWithToken(db, second))?.playerId).toBe('julia');

    await endSession(db, s1!.sessionToken);
    expect(await playerForSession(db, s1!.sessionToken)).toBeNull();
    expect(await loginWithToken(db, 'not-a-valid-token-at-all-xxxxx')).toBeNull();
    await expect(issueLoginToken(db, 'nobody')).rejects.toThrow();
  });
});

describe('race tips', () => {
  it('saves before the deadline with the server time, and can be changed', async () => {
    const { db, season } = await fresh();
    let data = await loadSeason(db, season.season);
    expect(await saveRaceTip(db, data, 'thomas', 20, tip, beforeBrazil)).toEqual({ ok: true });
    data = await loadSeason(db, season.season);
    expect(data.game.raceTips[20].thomas).toMatchObject({ winner: 'norris', podium: ['norris', 'piastri', 'leclerc'], pole: 'norris', fastestLap: '', dnf: 'stroll', submittedAt: beforeBrazil.toISOString() });

    const later = new Date(brazilStart.getTime() - 1000);
    expect(await saveRaceTip(db, data, 'thomas', 20, { ...tip, winner: 'verstappen' }, later)).toEqual({ ok: true });
    data = await loadSeason(db, season.season);
    expect(data.game.raceTips[20].thomas).toMatchObject({ winner: 'verstappen', submittedAt: later.toISOString() });
    expect(Object.keys(data.game.raceTips[20])).toEqual(['thomas']);
  });

  it('refuses tips at or after race start', async () => {
    const { db, data } = await fresh();
    expect(await saveRaceTip(db, data, 'thomas', 20, tip, afterBrazil)).toMatchObject({ ok: false, status: 403 });
    expect(await saveRaceTip(db, data, 'thomas', 1, tip, beforeBrazil)).toMatchObject({ ok: false, status: 403 });
  });

  it('validates the tip', async () => {
    const { db, data } = await fresh();
    const bad = async (patch: Partial<typeof tip>) => (await saveRaceTip(db, data, 'thomas', 20, { ...tip, ...patch }, beforeBrazil));
    expect(await bad({ p3: '' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ p2: 'norris' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ pole: 'schumacher' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ bestConstructor: 'brabham' })).toMatchObject({ ok: false, status: 400 });
    expect(await bad({ dnf: 'alonso', dns: 'alonso' })).toMatchObject({ ok: false, status: 400 });
    expect(await saveRaceTip(db, data, 'thomas', 99, tip, beforeBrazil)).toMatchObject({ ok: false, status: 404 });
  });

  it('a saved tip scores like the legacy app (empty optional fields stored as empty, as before)', async () => {
    const { db, season, data } = await fresh();
    await saveRaceTip(db, data, 'julia', 20, tip, beforeBrazil);
    const loaded = await loadSeason(db, season.season);
    const result = { winner: 'norris', podium: ['norris', 'leclerc', 'piastri'], pole: 'norris', fastestLap: 'piastri', bestConstructor: 'mclaren', dnf: ['stroll'], dns: [] };
    // 3 winner + 2 bonus (P2/P3 swapped) + 3 pole + 3 constructor + 3 DNF = 14
    expect(scoreRace(loaded.game.raceTips[20].julia, result, loaded.races[19]).total).toBe(14);
  });
});

describe('sprint tips', () => {
  it('only on sprint weekends and before the sprint start', async () => {
    const { db, data } = await fresh();
    const sprintRound = data.races.find(r => r.sprint)!;
    expect(await saveSprintTip(db, data, 'viktor', 20, { winner: 'norris', p2: 'piastri', p3: 'leclerc' }, beforeBrazil)).toMatchObject({ ok: false, status: 400 });
    const before = new Date(new Date(sprintRound.sprintStartUTC!).getTime() - 60_000);
    const at = new Date(sprintRound.sprintStartUTC!);
    expect(await saveSprintTip(db, data, 'viktor', sprintRound.round, { winner: 'norris', p2: 'piastri', p3: 'leclerc' }, before)).toEqual({ ok: true });
    expect(await saveSprintTip(db, data, 'viktor', sprintRound.round, { winner: 'norris', p2: 'piastri', p3: 'leclerc' }, at)).toMatchObject({ ok: false, status: 403 });
  });
});

describe('own tip visible, others hidden before the deadline (review N2)', () => {
  it('a signed-in player sees only their own open tip', async () => {
    const { db, season, data } = await fresh();
    await saveRaceTip(db, data, 'thomas', 20, { ...tip, winner: 'hulkenberg', p2: 'bortoleto', p3: 'gasly' }, beforeBrazil);
    await saveRaceTip(db, data, 'julia', 20, { ...tip, winner: 'bearman', p2: 'ocon', p3: 'lawson' }, beforeBrazil);
    const loaded = await loadSeason(db, season.season);

    const asThomas = JSON.stringify(raceView(loaded, 20, beforeBrazil, 'thomas'));
    expect(asThomas).toContain('hulkenberg');
    for (const secret of ['bearman', 'ocon', 'lawson']) expect(asThomas).not.toContain(secret);

    const anonymous = JSON.stringify(raceView(loaded, 20, beforeBrazil, null));
    for (const secret of ['hulkenberg', 'bortoleto', 'bearman', 'ocon']) expect(anonymous).not.toContain(secret);

    const afterStart = JSON.stringify(raceView(loaded, 20, afterBrazil, null));
    expect(afterStart).toContain('hulkenberg');
    expect(afterStart).toContain('bearman');
  });
});
