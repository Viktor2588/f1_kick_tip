// Request handling for the Kick Tip Worker. `now` is injectable so deadlines can be tested.
import { rowsToGame } from '../shared/model.js';
import { deadline, isOpen, validateRaceTip, validateSprintTip, validateSeasonTip } from '../shared/tips.js';
import { handleAdmin } from './admin.js';
import { buildIcs } from './ics.js';

const COOKIE = 'kt_session';
const COOKIE_MAX_AGE = 400 * 24 * 3600;

const TABLES = {
  players: 'SELECT id, name, emoji, color, is_admin FROM players ORDER BY sort, name',
  teams: 'SELECT * FROM teams ORDER BY sort',
  drivers: 'SELECT * FROM drivers ORDER BY sort',
  races: 'SELECT * FROM races ORDER BY round',
  race_tips: 'SELECT * FROM race_tips',
  sprint_tips: 'SELECT * FROM sprint_tips',
  season_tips: 'SELECT * FROM season_tips',
  race_results: 'SELECT * FROM race_results',
  sprint_results: 'SELECT * FROM sprint_results',
  season_final: 'SELECT * FROM season_final',
  news: 'SELECT * FROM news ORDER BY date DESC, id DESC LIMIT 20',
};

export async function loadGame(db) {
  const names = Object.keys(TABLES);
  const results = await db.batch(names.map((n) => db.prepare(TABLES[n])));
  return rowsToGame(Object.fromEntries(names.map((n, i) => [n, results[i].results])));
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...init.headers },
});
const fail = (status, error, extra = {}) => json({ error, ...extra }, { status });

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function sessionCookie(value, url, maxAge = COOKIE_MAX_AGE) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function currentPlayer(request, db) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await db.prepare('SELECT id, name, emoji, color, is_admin FROM players WHERE token_hash = ?').bind(await sha256(token)).first();
  return row ? { id: row.id, name: row.name, emoji: row.emoji, color: row.color, isAdmin: !!row.is_admin } : null;
}

/**
 * Hide other players' tips for sessions that haven't started yet. Everyone sees that someone tipped, not what.
 * The viewer's own tips stay visible to them.
 */
export function redactTips(game, viewerId, now) {
  const hidden = { hidden: true };
  const redact = (byRound, kind) => {
    for (const race of game.races) {
      const key = String(race.round);
      if (!byRound[key] || !isOpen(deadline(kind, race, game.races), now)) continue;
      for (const pid of Object.keys(byRound[key])) if (pid !== viewerId) byRound[key][pid] = hidden;
    }
  };
  redact(game.raceTips, 'race');
  redact(game.sprintTips, 'sprint');
  if (isOpen(deadline('season', null, game.races), now)) {
    for (const pid of Object.keys(game.seasonTips)) if (pid !== viewerId) game.seasonTips[pid] = hidden;
  }
  return game;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function known(db) {
  const [d, t] = await db.batch([db.prepare('SELECT id FROM drivers'), db.prepare('SELECT id FROM teams')]);
  return { drivers: new Set(d.results.map((r) => r.id)), teams: new Set(t.results.map((r) => r.id)) };
}

async function raceByRound(db, round) {
  const r = await db.prepare('SELECT * FROM races WHERE round = ?').bind(round).first();
  if (!r) return null;
  return { round: r.round, raceStartUTC: r.race_start, sprintStartUTC: r.sprint_start, sprint: !!r.sprint, dnfDns: !!r.dnf_dns };
}

async function saveTip(request, env, now, kind, round) {
  const db = env.DB;
  const player = await currentPlayer(request, db);
  if (!player) return fail(401, 'Bitte öffne zuerst deinen persönlichen Link.');
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return fail(400, 'Ungültige Anfrage.');
  const nowIso = new Date(now).toISOString();

  if (kind === 'season') {
    const first = await db.prepare('SELECT race_start FROM races ORDER BY round LIMIT 1').first();
    if (!isOpen(first?.race_start, now)) return fail(409, 'Der Saison-Tipp ist seit dem Start von Runde 1 geschlossen.');
    const { tip, errors } = validateSeasonTip(body, await known(db));
    if (errors.length) return fail(422, errors[0], { errors });
    await db.prepare(`INSERT INTO season_tips (player_id, wdc, wcc, submitted_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (player_id) DO UPDATE SET wdc = excluded.wdc, wcc = excluded.wcc, submitted_at = excluded.submitted_at`)
      .bind(player.id, tip.wdc, tip.wcc, nowIso).run();
    return json({ ok: true, tip: { ...tip, submittedAt: nowIso } });
  }

  const race = await raceByRound(db, round);
  if (!race) return fail(404, 'Dieses Rennen gibt es nicht.');
  const close = deadline(kind, race, []);
  if (!close) return fail(422, 'An diesem Wochenende gibt es keinen Sprint.');
  if (!isOpen(close, now)) return fail(409, kind === 'sprint' ? 'Der Sprint hat schon begonnen – Tippschluss.' : 'Das Rennen hat schon begonnen – Tippschluss.');

  if (kind === 'race') {
    const { tip, errors } = validateRaceTip(body, race, await known(db));
    if (errors.length) return fail(422, errors[0], { errors });
    await db.prepare(`INSERT INTO race_tips (round, player_id, winner, p1, p2, p3, pole, fastest_lap, best_constructor, dnf, dns, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (round, player_id) DO UPDATE SET winner = excluded.winner, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3,
        pole = excluded.pole, fastest_lap = excluded.fastest_lap, best_constructor = excluded.best_constructor,
        dnf = excluded.dnf, dns = excluded.dns, submitted_at = excluded.submitted_at`)
      .bind(race.round, player.id, tip.winner, tip.podium[0], tip.podium[1], tip.podium[2], tip.pole, tip.fastestLap, tip.bestConstructor, tip.dnf, tip.dns, nowIso).run();
    return json({ ok: true, tip: { ...tip, submittedAt: nowIso } });
  }

  const { tip, errors } = validateSprintTip(body, race, await known(db));
  if (errors.length) return fail(422, errors[0], { errors });
  await db.prepare(`INSERT INTO sprint_tips (round, player_id, winner, p1, p2, p3, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (round, player_id) DO UPDATE SET winner = excluded.winner, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, submitted_at = excluded.submitted_at`)
    .bind(race.round, player.id, tip.winner, tip.podium[0], tip.podium[1], tip.podium[2], nowIso).run();
  return json({ ok: true, tip: { ...tip, submittedAt: nowIso } });
}

async function join(request, env, url) {
  const token = decodeURIComponent(url.pathname.slice('/join/'.length));
  const row = token && await env.DB.prepare('SELECT id FROM players WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!row) return new Response(null, { status: 302, headers: { location: '/?link=ungueltig' } });
  return new Response(null, { status: 302, headers: { location: '/?willkommen=1', 'set-cookie': sessionCookie(token, url), 'referrer-policy': 'no-referrer' } });
}

export async function handle(request, env, { now = Date.now(), fetchFn } = {}) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname.startsWith('/join/')) return join(request, env, url);
  if (pathname === '/kalender.ics') {
    const races = (await env.DB.prepare('SELECT * FROM races ORDER BY round').all()).results;
    return new Response(buildIcs(races, { origin: url.origin, now }), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  // Writes only from our own pages (cookie is SameSite=Lax; this blocks cross-site form posts as well).
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return fail(403, 'Nicht erlaubt.');
  }

  if (pathname === '/api/state' && method === 'GET') {
    const [game, me] = await Promise.all([loadGame(env.DB), currentPlayer(request, env.DB)]);
    return json({ serverTime: new Date(now).toISOString(), me, ...redactTips(game, me?.id, now) });
  }
  if (pathname === '/api/logout' && method === 'POST') {
    return json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', url, 0) } });
  }
  if (pathname === '/api/health') return json({ ok: true });

  let m;
  if ((m = pathname.match(/^\/api\/tips\/(race|sprint)\/(\d+)$/)) && method === 'PUT') return saveTip(request, env, now, m[1], Number(m[2]));
  if (pathname === '/api/tips/season' && method === 'PUT') return saveTip(request, env, now, 'season');
  if (pathname.startsWith('/api/admin/')) {
    return handleAdmin(request, env, { now, player: await currentPlayer(request, env.DB), ctx: { newToken, sha256, fetch: fetchFn } });
  }

  return fail(404, 'Nicht gefunden.');
}
