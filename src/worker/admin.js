// Admin API (Viktor): results, season final, news, personal links. Every route requires an admin session.
import { fetchPrefill } from './prefill.js';

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...init.headers },
});
const fail = (status, error) => json({ error }, { status });

async function sets(db) {
  const [d, t] = await db.batch([db.prepare('SELECT id, name FROM drivers'), db.prepare('SELECT id FROM teams')]);
  return { drivers: new Set(d.results.map((r) => r.id)), teams: new Set(t.results.map((r) => r.id)), driverRows: d.results };
}

function checkPodium(podium, known) {
  if (!Array.isArray(podium) || podium.length !== 3 || podium.some((d) => !known.drivers.has(d))) return 'Bitte P1, P2 und P3 mit gültigen Fahrern angeben.';
  if (new Set(podium).size !== 3) return 'Ein Fahrer kann nur einmal aufs Podium.';
  return null;
}

const driverList = (v, known) => (Array.isArray(v) ? [...new Set(v.filter((d) => known.drivers.has(d)))] : []);

export async function handleAdmin(request, env, { now, player, ctx }) {
  const url = new URL(request.url);
  const path = url.pathname.slice('/api/admin'.length);
  const method = request.method;
  const db = env.DB;
  if (!player) return fail(401, 'Bitte öffne zuerst deinen persönlichen Link.');
  if (!player.isAdmin) return fail(403, 'Nur für Admins.');
  const body = method === 'GET' || method === 'DELETE' ? null : await request.json().catch(() => null);
  const nowIso = new Date(now).toISOString();
  let m;

  if ((m = path.match(/^\/results\/race\/(\d+)$/))) {
    const round = Number(m[1]);
    const race = await db.prepare('SELECT round, dnf_dns FROM races WHERE round = ?').bind(round).first();
    if (!race) return fail(404, 'Dieses Rennen gibt es nicht.');
    if (method === 'DELETE') { await db.prepare('DELETE FROM race_results WHERE round = ?').bind(round).run(); return json({ ok: true }); }
    if (method !== 'PUT' || !body) return fail(400, 'Ungültige Anfrage.');
    const known = await sets(db);
    const err = checkPodium(body.podium, known);
    if (err) return fail(422, err);
    for (const k of ['pole', 'fastestLap']) if (!known.drivers.has(body[k])) return fail(422, `Bitte ${k === 'pole' ? 'Pole' : 'schnellste Runde'} angeben.`);
    if (!known.teams.has(body.bestConstructor)) return fail(422, 'Bitte den besten Konstrukteur angeben.');
    const dnf = race.dnf_dns ? JSON.stringify(driverList(body.dnf, known)) : null;
    const dns = race.dnf_dns ? JSON.stringify(driverList(body.dns, known)) : null;
    const topTen = Array.isArray(body.topTen) && body.topTen.length ? JSON.stringify(body.topTen.filter((d) => known.drivers.has(d)).slice(0, 10)) : null;
    await db.prepare(`INSERT INTO race_results (round, winner, p1, p2, p3, pole, fastest_lap, best_constructor, top_ten, dnf, dns, entered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (round) DO UPDATE SET winner = excluded.winner, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, pole = excluded.pole,
        fastest_lap = excluded.fastest_lap, best_constructor = excluded.best_constructor, top_ten = excluded.top_ten, dnf = excluded.dnf,
        dns = excluded.dns, entered_at = excluded.entered_at`)
      .bind(round, body.podium[0], body.podium[0], body.podium[1], body.podium[2], body.pole, body.fastestLap, body.bestConstructor, topTen, dnf, dns, nowIso).run();
    return json({ ok: true });
  }

  if ((m = path.match(/^\/results\/sprint\/(\d+)$/))) {
    const round = Number(m[1]);
    const race = await db.prepare('SELECT round, sprint FROM races WHERE round = ?').bind(round).first();
    if (!race || !race.sprint) return fail(404, 'An diesem Wochenende gibt es keinen Sprint.');
    if (method === 'DELETE') { await db.prepare('DELETE FROM sprint_results WHERE round = ?').bind(round).run(); return json({ ok: true }); }
    if (method !== 'PUT' || !body) return fail(400, 'Ungültige Anfrage.');
    const err = checkPodium(body.podium, await sets(db));
    if (err) return fail(422, err);
    await db.prepare(`INSERT INTO sprint_results (round, winner, p1, p2, p3, entered_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (round) DO UPDATE SET winner = excluded.winner, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, entered_at = excluded.entered_at`)
      .bind(round, body.podium[0], body.podium[0], body.podium[1], body.podium[2], nowIso).run();
    return json({ ok: true });
  }

  if (path === '/season-final') {
    if (method === 'DELETE') { await db.prepare('DELETE FROM season_final').run(); return json({ ok: true }); }
    const known = await sets(db);
    if (method !== 'PUT' || !body || !known.drivers.has(body.wdc) || !known.teams.has(body.wcc)) return fail(422, 'Bitte Weltmeister und Konstrukteurs-Weltmeister angeben.');
    await db.prepare('INSERT INTO season_final (id, wdc, wcc) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET wdc = excluded.wdc, wcc = excluded.wcc').bind(body.wdc, body.wcc).run();
    return json({ ok: true });
  }

  if (path === '/news' && method === 'POST') {
    const items = Array.isArray(body?.items) ? body.items.map((s) => String(s).trim()).filter(Boolean).slice(0, 8) : [];
    if (!items.length) return fail(422, 'Bitte mindestens eine Zeile schreiben.');
    await db.prepare('INSERT INTO news (date, items) VALUES (?, ?)').bind(nowIso, JSON.stringify(items)).run();
    return json({ ok: true });
  }
  if ((m = path.match(/^\/news\/(\d+)$/)) && method === 'DELETE') {
    await db.prepare('DELETE FROM news WHERE id = ?').bind(Number(m[1])).run();
    return json({ ok: true });
  }

  if ((m = path.match(/^\/players\/([a-z0-9_-]+)\/link$/)) && method === 'POST') {
    const exists = await db.prepare('SELECT id FROM players WHERE id = ?').bind(m[1]).first();
    if (!exists) return fail(404, 'Unbekannter Spieler.');
    const token = ctx.newToken();
    await db.prepare('UPDATE players SET token_hash = ? WHERE id = ?').bind(await ctx.sha256(token), m[1]).run();
    return json({ ok: true, link: `${url.origin}/join/${token}` });
  }

  if ((m = path.match(/^\/prefill\/(\d+)$/)) && method === 'GET') {
    const round = Number(m[1]);
    const race = await db.prepare('SELECT round, sprint, dnf_dns FROM races WHERE round = ?').bind(round).first();
    if (!race) return fail(404, 'Dieses Rennen gibt es nicht.');
    const known = await sets(db);
    try {
      const drivers = (await db.prepare('SELECT id, name FROM drivers').all()).results;
      const data = await fetchPrefill({ season: 2026, round, drivers, isSprint: !!race.sprint, dnfDns: !!race.dnf_dns, fetchFn: ctx.fetch || fetch });
      return json({ ok: true, ...data, known: known.drivers.size });
    } catch (e) {
      return fail(502, `Ergebnis-Vorschlag gerade nicht verfügbar (${e.message}). Bitte von Hand eintragen.`);
    }
  }

  return fail(404, 'Nicht gefunden.');
}
