// F1 Kick Tip – Cloudflare Worker: JSON API in front of D1. Static files are served by the assets binding.
import { rowsToGame } from '../shared/model.js';

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

async function loadGame(db) {
  const names = Object.keys(TABLES);
  const results = await db.batch(names.map((n) => db.prepare(TABLES[n])));
  return rowsToGame(Object.fromEntries(names.map((n, i) => [n, results[i].results])));
}

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...init.headers },
});

async function handleApi(request, env, url) {
  if (url.pathname === '/api/state' && request.method === 'GET') {
    const game = await loadGame(env.DB);
    return json({ serverTime: new Date().toISOString(), ...game });
  }
  if (url.pathname === '/api/health') return json({ ok: true });
  return json({ error: 'Nicht gefunden' }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: 'Serverfehler' }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
