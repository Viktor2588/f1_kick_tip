// Conversion between database rows and the in-memory "game" shape used by scoring and UI.

const parseList = (v) => {
  if (v == null || v === '') return undefined;
  if (Array.isArray(v)) return v;
  try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : undefined; } catch { return undefined; }
};

const byRound = (rows, map) => {
  const out = {};
  for (const r of rows) out[String(r.round)] = map(r);
  return out;
};

const byRoundAndPlayer = (rows, map) => {
  const out = {};
  for (const r of rows) (out[String(r.round)] ??= {})[r.player_id] = map(r);
  return out;
};

export function raceFromRow(r) {
  return {
    round: r.round, name: r.name, country: r.country, countryCode: r.country_code, circuit: r.circuit, city: r.city,
    date: r.date, qualiStartUTC: r.quali_start, sprintStartUTC: r.sprint_start, raceStartUTC: r.race_start,
    sprint: !!r.sprint, dnfDns: !!r.dnf_dns,
  };
}

export const raceTipFromRow = (r) => ({
  winner: r.winner, podium: [r.p1, r.p2, r.p3], pole: r.pole, fastestLap: r.fastest_lap,
  bestConstructor: r.best_constructor, dnf: r.dnf, dns: r.dns, submittedAt: r.submitted_at,
});

export const sprintTipFromRow = (r) => ({ winner: r.winner, podium: [r.p1, r.p2, r.p3], submittedAt: r.submitted_at });

export const raceResultFromRow = (r) => ({
  winner: r.winner, podium: [r.p1, r.p2, r.p3], pole: r.pole, fastestLap: r.fastest_lap,
  bestConstructor: r.best_constructor, topTen: parseList(r.top_ten), dnf: parseList(r.dnf), dns: parseList(r.dns),
  enteredAt: r.entered_at,
});

export const sprintResultFromRow = (r) => ({ winner: r.winner, podium: [r.p1, r.p2, r.p3], enteredAt: r.entered_at });

/** Build the game object from table rows (as returned by D1 `SELECT *`). */
export function rowsToGame(t) {
  const final = t.season_final?.[0];
  return {
    season: 2026,
    players: t.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, isAdmin: !!p.is_admin })),
    teams: t.teams.map((x) => ({ id: x.id, name: x.name, color: x.color })),
    drivers: t.drivers.map((d) => ({ id: d.id, name: d.name, number: d.number, team: d.team_id })),
    races: t.races.map(raceFromRow),
    raceTips: byRoundAndPlayer(t.race_tips, raceTipFromRow),
    sprintTips: byRoundAndPlayer(t.sprint_tips, sprintTipFromRow),
    seasonTips: Object.fromEntries(t.season_tips.map((r) => [r.player_id, { wdc: r.wdc, wcc: r.wcc, submittedAt: r.submitted_at }])),
    raceResults: byRound(t.race_results, raceResultFromRow),
    sprintResults: byRound(t.sprint_results, sprintResultFromRow),
    seasonFinal: final && (final.wdc || final.wcc) ? { wdc: final.wdc, wcc: final.wcc } : null,
    news: (t.news || []).map((n) => ({ id: n.id, date: n.date, items: parseList(n.items) || [] })),
  };
}
