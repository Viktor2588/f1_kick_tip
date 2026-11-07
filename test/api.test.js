import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createD1 } from './helpers/d1.js';
import { handle, sha256 } from '../src/worker/app.js';
import { seasonRows, dataRows, toSql, TABLE_ORDER } from '../src/shared/import.js';

const season = JSON.parse(readFileSync(new URL('../seed/season-2026.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../fixtures/demo-2026.json', import.meta.url), 'utf8'));
const BASE = 'http://127.0.0.1:5190';
const BRAZIL = 20; // race 2026-11-08T17:00:00Z, demo has tips from thomas + viktor, none from julia
const BEFORE_BRAZIL = Date.parse('2026-11-07T12:00:00Z');
const AFTER_BRAZIL = Date.parse('2026-11-08T17:00:01Z');

let env;
beforeEach(async () => {
  const db = createD1();
  const { rows } = dataRows(demo, season.players.map((p) => p.id));
  db.raw.exec(toSql({ ...seasonRows(season), ...rows }, { order: TABLE_ORDER }));
  for (const pid of ['thomas', 'julia', 'viktor']) db.raw.prepare('UPDATE players SET token_hash = ? WHERE id = ?').run(await sha256(`token-${pid}`), pid);
  env = { DB: db, ASSETS: { fetch: () => new Response('asset') } };
});

const call = (path, { method = 'GET', body, as, now = BEFORE_BRAZIL, origin } = {}) => handle(new Request(BASE + path, {
  method,
  headers: { ...(as ? { cookie: `kt_session=token-${as}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}), env, { now });

const raceTip = { podium: ['norris', 'piastri', 'verstappen'], pole: 'norris', fastestLap: 'russell', bestConstructor: 'mclaren', dnf: 'stroll', dns: '' };

test('join link sets an HttpOnly session cookie and redirects home; bad links do not', async () => {
  const ok = await call('/join/token-julia');
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get('set-cookie'), /kt_session=token-julia; Path=\/; HttpOnly; SameSite=Lax/);
  const bad = await call('/join/nope');
  assert.equal(bad.status, 302);
  assert.equal(bad.headers.get('set-cookie'), null);
  assert.match(bad.headers.get('location'), /link=ungueltig/);
});

test('state knows who I am, never exposes token hashes', async () => {
  const anon = await (await call('/api/state')).json();
  assert.equal(anon.me, null);
  const me = await (await call('/api/state', { as: 'julia' })).json();
  assert.equal(me.me.id, 'julia');
  assert.ok(!JSON.stringify(me).includes('token'));
});

test('tips for a session that has not started are hidden from others, visible to the owner', async () => {
  const asJulia = await (await call('/api/state', { as: 'julia' })).json();
  assert.deepEqual(asJulia.raceTips[BRAZIL].thomas, { hidden: true });
  const asThomas = await (await call('/api/state', { as: 'thomas' })).json();
  assert.equal(typeof asThomas.raceTips[BRAZIL].thomas.winner, 'string');
  assert.deepEqual(asThomas.raceTips[BRAZIL].viktor, { hidden: true });
  // Past races stay fully visible.
  assert.equal(typeof asJulia.raceTips[19].thomas.winner, 'string');
  // After lights-out everyone sees everything.
  const later = await (await call('/api/state', { as: 'julia', now: AFTER_BRAZIL })).json();
  assert.equal(typeof later.raceTips[BRAZIL].thomas.winner, 'string');
});

test('saving a race tip: requires a link, server stamps the time, and it shows up', async () => {
  assert.equal((await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: raceTip })).status, 401);
  const res = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: { ...raceTip, submittedAt: '2020-01-01T00:00:00Z' }, as: 'julia' });
  assert.equal(res.status, 200);
  const saved = (await res.json()).tip;
  assert.equal(saved.submittedAt, new Date(BEFORE_BRAZIL).toISOString());
  assert.equal(saved.winner, 'norris');
  const state = await (await call('/api/state', { as: 'julia' })).json();
  assert.equal(state.raceTips[BRAZIL].julia.dnf, 'stroll');
  // Changing the tip replaces it.
  await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: { ...raceTip, podium: ['russell', 'norris', 'piastri'] }, as: 'julia' });
  const again = await (await call('/api/state', { as: 'julia' })).json();
  assert.equal(again.raceTips[BRAZIL].julia.winner, 'russell');
});

test('tips after lights-out are refused', async () => {
  const res = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: raceTip, as: 'julia', now: AFTER_BRAZIL });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /Tippschluss/);
});

test('invalid tips are refused with a German reason', async () => {
  const dup = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: { ...raceTip, podium: ['norris', 'norris', 'piastri'] }, as: 'julia' });
  assert.equal(dup.status, 422);
  assert.match((await dup.json()).error, /nur einmal/);
  const both = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: { ...raceTip, dnf: 'ocon', dns: 'ocon' }, as: 'julia' });
  assert.equal(both.status, 422);
  const unknown = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: { ...raceTip, pole: 'schumacher' }, as: 'julia' });
  assert.equal(unknown.status, 422);
});

test('sprint tips only on sprint weekends and before the sprint', async () => {
  assert.equal((await call(`/api/tips/sprint/${BRAZIL}`, { method: 'PUT', body: { podium: ['norris', 'piastri', 'russell'] }, as: 'julia' })).status, 422);
  // Singapore (round 17) sprint: 2026-10-10T09:30:00Z
  const before = Date.parse('2026-10-10T09:00:00Z');
  assert.equal((await call('/api/tips/sprint/17', { method: 'PUT', body: { podium: ['norris', 'piastri', 'russell'] }, as: 'julia', now: before })).status, 200);
  assert.equal((await call('/api/tips/sprint/17', { method: 'PUT', body: { podium: ['norris', 'piastri', 'russell'] }, as: 'julia', now: Date.parse('2026-10-10T09:31:00Z') })).status, 409);
});

test('season tip closes at the start of round 1', async () => {
  const early = Date.parse('2026-03-01T00:00:00Z');
  assert.equal((await call('/api/tips/season', { method: 'PUT', body: { wdc: 'norris', wcc: 'mclaren' }, as: 'julia', now: early })).status, 200);
  assert.equal((await call('/api/tips/season', { method: 'PUT', body: { wdc: 'norris', wcc: 'mclaren' }, as: 'julia' })).status, 409);
});

test('season tips are hidden from others until round 1 starts', async () => {
  const early = Date.parse('2026-03-01T00:00:00Z');
  const st = await (await call('/api/state', { as: 'julia', now: early })).json();
  assert.deepEqual(st.seasonTips.thomas, { hidden: true });
  assert.equal(st.seasonTips.julia.wdc, 'norris');
});

test('cross-site writes are refused', async () => {
  const res = await call(`/api/tips/race/${BRAZIL}`, { method: 'PUT', body: raceTip, as: 'julia', origin: 'https://evil.example' });
  assert.equal(res.status, 403);
});

test('logout clears the cookie', async () => {
  const res = await call('/api/logout', { method: 'POST', as: 'julia' });
  assert.match(res.headers.get('set-cookie'), /kt_session=; .*Max-Age=0/);
});

test('calendar feed lists every race and sprint with a 2h reminder', async () => {
  const res = await call('/kalender.ics');
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  const body = await res.text();
  assert.equal((body.match(/BEGIN:VEVENT/g) || []).length, 23 + 6);
  assert.match(body, /DTSTART:20261108T170000Z/);
  assert.match(body, /TRIGGER:-PT2H/);
  assert.ok(body.split('\r\n').every((l) => l.length <= 75));
});
