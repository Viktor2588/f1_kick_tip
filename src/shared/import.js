// Import of 2026 data from the old app into table rows.
//
// Accepted data shapes (any mix, per collection):
//   - app format, as js/api.js fetchAllData() returns it or as data/*.json files:
//       { predictions: { predictions: { "1": { thomas: {...} } } }, sprintPredictions: {...}, seasonPredictions: {...},
//         results: {...}, sprintResults: {...} }   (the inner wrapper key is optional)
//   - raw table rows from the old Postgres schema:
//       { race_predictions: [...], sprint_predictions: [...], season_predictions: [...], race_results: [...], sprint_results: [...] }
// Values are copied verbatim (including empty strings) so scores stay identical.

export const DNF_DNS_FROM_ROUND = 16;

const unwrap = (v, key) => (v && typeof v === 'object' && key in v && !Array.isArray(v) ? v[key] : v);

function appCollection(data, key) {
  const v = unwrap(data[key], key);
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

const list = (v) => (v == null ? null : Array.isArray(v) ? v : typeof v === 'string' && v.startsWith('[') ? JSON.parse(v) : null);
const json = (v) => { const l = list(v); return l ? JSON.stringify(l) : null; };
const ts = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

export function seasonRows(season) {
  return {
    players: season.players.map((p, i) => ({ id: p.id, name: p.name, emoji: p.emoji || '', color: p.color || '#888888', is_admin: p.isAdmin ? 1 : 0, token_hash: null, sort: i })),
    teams: season.teams.map((t, i) => ({ id: t.id, name: t.name, color: t.color, sort: i })),
    drivers: season.drivers.map((d, i) => ({ id: d.id, name: d.name, number: d.number ?? null, team_id: d.team, sort: i })),
    races: season.races.map((r) => ({
      round: r.round, name: r.name, country: r.country, country_code: r.countryCode, circuit: r.circuit, city: r.city,
      date: r.date, quali_start: r.qualiStartUTC ?? null, sprint_start: r.sprintStartUTC ?? null, race_start: r.raceStartUTC,
      sprint: r.sprint ? 1 : 0, dnf_dns: r.dnfDns ?? r.round >= DNF_DNS_FROM_ROUND ? 1 : 0,
    })),
  };
}

/** Convert old-app data into rows. Tips by players not in `playerIds` are skipped and reported. */
export function dataRows(data, playerIds) {
  const known = new Set(playerIds);
  const skipped = new Set();
  const keep = (pid) => (known.has(pid) ? true : (skipped.add(pid), false));
  const rows = { race_tips: [], sprint_tips: [], season_tips: [], race_results: [], sprint_results: [], season_final: [] };

  if (Array.isArray(data.race_predictions)) {
    for (const r of data.race_predictions) if (keep(r.player_id)) rows.race_tips.push({
      round: Number(r.round), player_id: r.player_id, winner: r.winner, p1: r.podium_p1, p2: r.podium_p2, p3: r.podium_p3,
      pole: r.pole, fastest_lap: r.fastest_lap, best_constructor: r.best_constructor, dnf: r.dnf ?? null, dns: r.dns ?? null,
      submitted_at: ts(r.submitted_at),
    });
  } else {
    for (const [round, byPlayer] of Object.entries(appCollection(data, 'predictions') || {})) {
      for (const [pid, t] of Object.entries(byPlayer)) if (keep(pid)) rows.race_tips.push({
        round: Number(round), player_id: pid, winner: t.winner, p1: t.podium?.[0] ?? null, p2: t.podium?.[1] ?? null, p3: t.podium?.[2] ?? null,
        pole: t.pole ?? null, fastest_lap: t.fastestLap ?? null, best_constructor: t.bestConstructor ?? null,
        dnf: t.dnf ?? null, dns: t.dns ?? null, submitted_at: ts(t.submittedAt),
      });
    }
  }

  if (Array.isArray(data.sprint_predictions)) {
    for (const r of data.sprint_predictions) if (keep(r.player_id)) rows.sprint_tips.push({
      round: Number(r.round), player_id: r.player_id, winner: r.winner, p1: r.podium_p1, p2: r.podium_p2, p3: r.podium_p3, submitted_at: ts(r.submitted_at),
    });
  } else {
    for (const [round, byPlayer] of Object.entries(appCollection(data, 'sprintPredictions') || {})) {
      for (const [pid, t] of Object.entries(byPlayer)) if (keep(pid)) rows.sprint_tips.push({
        round: Number(round), player_id: pid, winner: t.winner, p1: t.podium?.[0] ?? null, p2: t.podium?.[1] ?? null, p3: t.podium?.[2] ?? null, submitted_at: ts(t.submittedAt),
      });
    }
  }

  if (Array.isArray(data.season_predictions)) {
    for (const r of data.season_predictions) if (keep(r.player_id)) rows.season_tips.push({ player_id: r.player_id, wdc: r.wdc, wcc: r.wcc, submitted_at: ts(r.submitted_at) });
  } else {
    for (const [pid, t] of Object.entries(appCollection(data, 'seasonPredictions') || {})) if (keep(pid)) rows.season_tips.push({ player_id: pid, wdc: t.wdc, wcc: t.wcc, submitted_at: ts(t.submittedAt) });
  }

  if (Array.isArray(data.race_results)) {
    for (const r of data.race_results) rows.race_results.push({
      round: Number(r.round), winner: r.winner, p1: r.podium_p1, p2: r.podium_p2, p3: r.podium_p3, pole: r.pole, fastest_lap: r.fastest_lap,
      best_constructor: r.best_constructor, top_ten: json(r.top_ten), dnf: json(r.dnf), dns: json(r.dns), entered_at: ts(r.entered_at),
    });
  } else {
    for (const [round, r] of Object.entries(appCollection(data, 'results') || {})) rows.race_results.push({
      round: Number(round), winner: r.winner, p1: r.podium?.[0] ?? null, p2: r.podium?.[1] ?? null, p3: r.podium?.[2] ?? null,
      pole: r.pole ?? null, fastest_lap: r.fastestLap ?? null, best_constructor: r.bestConstructor ?? null,
      top_ten: json(r.topTen), dnf: json(r.dnf), dns: json(r.dns), entered_at: ts(r.enteredAt),
    });
  }

  if (Array.isArray(data.sprint_results)) {
    for (const r of data.sprint_results) rows.sprint_results.push({ round: Number(r.round), winner: r.winner, p1: r.podium_p1, p2: r.podium_p2, p3: r.podium_p3, entered_at: ts(r.entered_at) });
  } else {
    for (const [round, r] of Object.entries(appCollection(data, 'sprintResults') || {})) rows.sprint_results.push({
      round: Number(round), winner: r.winner, p1: r.podium?.[0] ?? null, p2: r.podium?.[1] ?? null, p3: r.podium?.[2] ?? null, entered_at: ts(r.enteredAt),
    });
  }

  const final = data.finalStandings || data.seasonFinal;
  if (final && (final.wdc || final.wcc)) rows.season_final.push({ id: 1, wdc: final.wdc ?? null, wcc: final.wcc ?? null });

  return { rows, skippedPlayers: [...skipped] };
}

const sqlValue = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);

/** SQL that replaces all season and game data (players keep their link tokens if they already exist). */
export function toSql(tables, { order } = {}) {
  const names = order || Object.keys(tables);
  const out = [];
  for (const name of [...names].reverse()) if (name !== 'players') out.push(`DELETE FROM ${name};`);
  for (const name of names) {
    for (const row of tables[name]) {
      const cols = Object.keys(row);
      if (name === 'players') {
        const upd = cols.filter((c) => c !== 'id' && c !== 'token_hash' && c !== 'is_admin').map((c) => `${c}=excluded.${c}`).join(', ');
        out.push(`INSERT INTO players (${cols.join(', ')}) VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')}) ON CONFLICT(id) DO UPDATE SET ${upd};`);
      } else {
        out.push(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')});`);
      }
    }
  }
  return out.join('\n') + '\n';
}

export const TABLE_ORDER = ['players', 'teams', 'drivers', 'races', 'race_tips', 'sprint_tips', 'season_tips', 'race_results', 'sprint_results', 'season_final'];
