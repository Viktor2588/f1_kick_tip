// Derived views of the game state: standings with movement, season progress, next session.
import { calculateStandings, accuracy } from '../../shared/scoring.js';

export function indexGame(game) {
  return {
    ...game,
    driverById: Object.fromEntries(game.drivers.map((d) => [d.id, d])),
    teamById: Object.fromEntries(game.teams.map((t) => [t.id, t])),
    playerById: Object.fromEntries(game.players.map((p) => [p.id, p])),
    raceByRound: Object.fromEntries(game.races.map((r) => [r.round, r])),
  };
}

export const finishedRounds = (g) => g.races.filter((r) => g.raceResults[String(r.round)]).map((r) => r.round);

/** Standings now, plus position change compared with before the last scored round and points over the season. */
export function standingsWithHistory(g) {
  const done = finishedRounds(g);
  const now = calculateStandings(g);
  const last = done[done.length - 1];
  const prev = done.length > 1 ? calculateStandings(g, { uptoRound: done[done.length - 2] }) : null;
  const prevPos = prev ? Object.fromEntries(prev.map((s, i) => [s.playerId, i])) : {};

  // Cumulative points per player after each finished round (race + sprint of that weekend).
  const series = Object.fromEntries(g.players.map((p) => [p.id, []]));
  for (const p of g.players) {
    let total = 0;
    const row = now.find((s) => s.playerId === p.id);
    for (const r of done) {
      total += (row.raceScores[r]?.total || 0) + (row.sprintScores[r]?.total || 0);
      series[p.id].push(total);
    }
  }

  return now.map((s, i) => {
    const lastWeekend = last ? (s.raceScores[last]?.total || 0) + (s.sprintScores[last]?.total || 0) : 0;
    return {
      ...s,
      position: i + 1,
      // Shared position when tied on everything the tiebreak looks at.
      move: prev ? prevPos[s.playerId] - i : 0,
      lastWeekend,
      accuracy: accuracy(s),
      series: series[s.playerId],
      gapToLeader: now[0].totalPoints - s.totalPoints,
    };
  });
}

/** The next session someone can still tip: sprint or race of the first race weekend whose race hasn't started. */
export function nextRace(g, now) {
  return g.races.find((r) => new Date(r.raceStartUTC).getTime() > now && !g.raceResults[String(r.round)]) || null;
}

/** Deadlines of a race weekend that are still open (sprint first). */
export function openSessions(race, now) {
  const out = [];
  if (race.sprint && race.sprintStartUTC && new Date(race.sprintStartUTC).getTime() > now) out.push({ kind: 'sprint', label: 'Sprint', start: race.sprintStartUTC });
  if (new Date(race.raceStartUTC).getTime() > now) out.push({ kind: 'race', label: 'Rennen', start: race.raceStartUTC });
  return out;
}

export function raceStatus(g, race, now) {
  if (g.raceResults[String(race.round)]) return 'done';
  if (new Date(race.raceStartUTC).getTime() <= now) return 'waiting'; // raced, result not in yet
  return 'open';
}
