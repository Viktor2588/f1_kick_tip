import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createD1 } from './helpers/d1.js';
import { handle, sha256 } from '../src/worker/app.js';
import { seasonRows, dataRows, toSql, TABLE_ORDER } from '../src/shared/import.js';
import { calculateStandings } from '../src/shared/scoring.js';
import { indexGame } from '../src/client/lib/derive.js';
import { mapRace } from '../src/worker/prefill.js';

const season = JSON.parse(readFileSync(new URL('../seed/season-2026.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../fixtures/demo-2026.json', import.meta.url), 'utf8'));
const BASE = 'http://127.0.0.1:5190';
const AFTER_BRAZIL = Date.parse('2026-11-09T10:00:00Z');

let env;
beforeEach(async () => {
  const db = createD1();
  const { rows } = dataRows(demo, season.players.map((p) => p.id));
  db.raw.exec(toSql({ ...seasonRows(season), ...rows }, { order: TABLE_ORDER }));
  for (const pid of ['thomas', 'viktor']) db.raw.prepare('UPDATE players SET token_hash = ? WHERE id = ?').run(await sha256(`token-${pid}`), pid);
  db.raw.prepare("UPDATE players SET is_admin = 1 WHERE id = 'viktor'").run();
  env = { DB: db, ASSETS: { fetch: () => new Response('asset') } };
});

const call = (path, { method = 'GET', body, as = 'viktor', now = AFTER_BRAZIL, fetchFn } = {}) => handle(new Request(BASE + path, {
  method, headers: { cookie: `kt_session=token-${as}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
}), env, { now, fetchFn });

const result20 = { podium: ['norris', 'piastri', 'russell'], pole: 'norris', fastestLap: 'verstappen', bestConstructor: 'mclaren', dnf: ['ocon', 'nobody'], dns: [] };

test('only the admin may enter results', async () => {
  assert.equal((await call('/api/admin/results/race/20', { method: 'PUT', body: result20, as: 'thomas' })).status, 403);
});

test('entering a result scores the round; deleting it un-scores it', async () => {
  const before = await (await call('/api/state')).json();
  const beforeStandings = calculateStandings(indexGame(before));
  assert.equal((await call('/api/admin/results/race/20', { method: 'PUT', body: result20 })).status, 200);
  const after = await (await call('/api/state')).json();
  assert.deepEqual(after.raceResults['20'].dnf, ['ocon']); // unknown ids dropped
  const afterStandings = calculateStandings(indexGame(after));
  const scored = afterStandings.filter((s) => s.raceScores[20]);
  assert.ok(scored.length >= 1);
  for (const s of scored) {
    const prev = beforeStandings.find((b) => b.playerId === s.playerId);
    assert.equal(s.totalPoints, prev.totalPoints + s.raceScores[20].total);
  }
  await call('/api/admin/results/race/20', { method: 'DELETE' });
  const gone = await (await call('/api/state')).json();
  assert.equal(gone.raceResults['20'], undefined);
});

test('result validation: duplicate podium refused; rounds before 16 store no DNF/DNS lists', async () => {
  assert.equal((await call('/api/admin/results/race/20', { method: 'PUT', body: { ...result20, podium: ['norris', 'norris', 'russell'] } })).status, 422);
  await call('/api/admin/results/race/15', { method: 'PUT', body: result20 });
  const st = await (await call('/api/state')).json();
  assert.equal(st.raceResults['15'].dnf, undefined); // keeps the 21-point maximum for old rounds
});

test('sprint results only on sprint weekends', async () => {
  assert.equal((await call('/api/admin/results/sprint/20', { method: 'PUT', body: { podium: ['norris', 'piastri', 'russell'] } })).status, 404);
  assert.equal((await call('/api/admin/results/sprint/17', { method: 'PUT', body: { podium: ['norris', 'piastri', 'russell'] } })).status, 200);
});

test('season final scores season tips', async () => {
  await call('/api/admin/season-final', { method: 'PUT', body: { wdc: 'norris', wcc: 'mclaren' } });
  const st = await (await call('/api/state')).json();
  const julia = calculateStandings(indexGame(st)).find((s) => s.playerId === 'julia');
  assert.equal(julia.seasonPoints, 35); // demo: julia tipped norris + mclaren
});

test('news shows up in the state', async () => {
  await call('/api/admin/news', { method: 'POST', body: { items: ['Ergebnis Brasilien ist eingetragen.'] } });
  const st = await (await call('/api/state')).json();
  assert.equal(st.news[0].items[0], 'Ergebnis Brasilien ist eingetragen.');
});

test('a new personal link replaces the old one', async () => {
  const res = await (await call('/api/admin/players/thomas/link', { method: 'POST' })).json();
  assert.match(res.link, /^http:\/\/127\.0\.0\.1:5190\/join\/[A-Za-z0-9_-]{20,}$/);
  const old = await (await call('/api/state', { as: 'thomas' })).json();
  assert.equal(old.me, null);
  const join = await handle(new Request(res.link), env, { now: AFTER_BRAZIL });
  assert.match(join.headers.get('set-cookie'), /kt_session=/);
});

// ── Prefill mapping ──
const D = (familyName, driverId = familyName.toLowerCase()) => ({ driverId, givenName: 'X', familyName });
const C = (constructorId) => ({ constructorId, name: constructorId });
const ergastRace = {
  Results: [
    { position: '2', points: '18', grid: '2', status: 'Finished', Driver: D('Piastri'), Constructor: C('mclaren') },
    { position: '1', points: '25', grid: '3', status: 'Finished', Driver: D('Russell'), Constructor: C('mercedes'), FastestLap: { rank: '1' } },
    { position: '3', points: '15', grid: '1', status: 'Finished', Driver: D('Norris'), Constructor: C('mclaren') },
    { position: '4', points: '12', grid: '5', status: '+1 Lap', Driver: D('Hülkenberg', 'hulkenberg'), Constructor: C('sauber') },
    { position: '19', points: '0', grid: '9', status: 'Engine', Driver: D('Ocon'), Constructor: C('haas') },
    { position: '20', points: '0', grid: '0', status: 'Did not start', Driver: D('Stroll'), Constructor: C('aston_martin') },
    { position: '18', points: '0', grid: '7', status: 'Finished', Driver: D('Newbie'), Constructor: C('alpine') },
  ],
};

test('prefill maps Jolpica results onto our ids, best constructor by points, DNF vs DNS', () => {
  const drivers = season.drivers.map((d) => ({ id: d.id, name: d.name }));
  const out = mapRace(ergastRace, { drivers, dnfDns: true, qualifying: { QualifyingResults: [{ position: '1', Driver: D('Norris') }] } });
  assert.deepEqual(out.race.podium, ['russell', 'piastri', 'norris']);
  assert.equal(out.race.pole, 'norris');
  assert.equal(out.race.fastestLap, 'russell');
  assert.equal(out.race.bestConstructor, 'mclaren'); // 33 points vs Mercedes 25
  assert.deepEqual(out.race.dnf, ['ocon']);
  assert.deepEqual(out.race.dns, ['stroll']);
  assert.ok(out.race.topTen.includes('hulkenberg'));
  assert.ok(out.unmapped.some((n) => n.includes('Newbie')));
});

test('prefill endpoint: admin only, and a failing source gives a readable error', async () => {
  const failing = async () => new Response('nope', { status: 503 });
  const res = await call('/api/admin/prefill/20', { fetchFn: failing });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /von Hand/);
  const ok = async (url) => new Response(JSON.stringify({ MRData: { RaceTable: { Races: [url.includes('/results') ? ergastRace : { QualifyingResults: [] }] } } }));
  const data = await (await call('/api/admin/prefill/20', { fetchFn: ok })).json();
  assert.deepEqual(data.race.podium, ['russell', 'piastri', 'norris']);
});
