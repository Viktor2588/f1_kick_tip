// F1 Kick Tip – scoring engine.
// Shared by the Worker and the browser. Rules are identical to the 2026 app (js/scoring.js on main);
// test/parity.test.js proves it against a verbatim copy of the original.

export const RACE_POINTS = { winner: 3, p2: 2, p3: 2, podiumBonus: 1, pole: 3, fastestLap: 3, bestConstructor: 3, perfect: 5, dnf: 3, dns: 5 };
export const SPRINT_POINTS = { winner: 3, p2: 1, p3: 1, podiumBonus: 1, perfect: 2 };
export const SEASON_POINTS = { wdc: 20, wcc: 15 };
export const SPRINT_MAX = 7;

/** A tip counts as late when it was submitted strictly after the deadline. Missing values are never late. */
export function isLate(submittedAt, deadlineUTC) {
  if (!submittedAt || !deadlineUTC) return false;
  return new Date(submittedAt) > new Date(deadlineUTC);
}

/** Max race points: 21, plus 8 when the result carries DNF/DNS lists (from round 16). */
export function raceMaxPoints(result) {
  return 21 + (Array.isArray(result?.dnf) ? 8 : 0);
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

/** Podium bonus: a tipped podium driver who finished on the podium, but not on the tipped spot. */
function podiumBonus(tipped, actual, exact) {
  let bonus = 0;
  for (let i = 0; i < 3; i++) {
    if (!tipped[i] || exact[i]) continue;
    if (actual.includes(tipped[i])) bonus += 1;
  }
  return bonus;
}

/**
 * Score a main race tip. Returns { total, breakdown, isPerfect, max, late? }.
 * The winner is P1, so the race podium uses `winner` for P1 and `podium[1..2]` for P2/P3.
 */
export function scoreRace(tip, result, race) {
  const breakdown = { winner: 0, podiumP2: 0, podiumP3: 0, podiumBonus: 0, pole: 0, fastestLap: 0, bestConstructor: 0, perfectRound: 0, dnf: 0, dns: 0 };
  const max = raceMaxPoints(result);
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false, max };
  if (isLate(tip.submittedAt, race.raceStartUTC)) return { total: 0, breakdown, isPerfect: false, late: true, max };

  const tipped = [tip.winner, tip.podium?.[1], tip.podium?.[2]];
  const actual = [result.winner, result.podium?.[1], result.podium?.[2]];

  if (tip.winner === result.winner) breakdown.winner = RACE_POINTS.winner;
  if (tipped[1] === actual[1]) breakdown.podiumP2 = RACE_POINTS.p2;
  if (tipped[2] === actual[2]) breakdown.podiumP3 = RACE_POINTS.p3;
  breakdown.podiumBonus = podiumBonus(tipped, actual, [breakdown.winner > 0, breakdown.podiumP2 > 0, breakdown.podiumP3 > 0]);
  if (tip.pole === result.pole) breakdown.pole = RACE_POINTS.pole;
  if (tip.fastestLap === result.fastestLap) breakdown.fastestLap = RACE_POINTS.fastestLap;
  if (tip.bestConstructor === result.bestConstructor) breakdown.bestConstructor = RACE_POINTS.bestConstructor;

  const isPerfect = breakdown.winner > 0 && breakdown.podiumP2 > 0 && breakdown.podiumP3 > 0
    && breakdown.pole > 0 && breakdown.fastestLap > 0 && breakdown.bestConstructor > 0;
  if (isPerfect) breakdown.perfectRound = RACE_POINTS.perfect;

  // DNF/DNS don't count towards the perfect round.
  if (tip.dnf && result.dnf?.includes(tip.dnf)) breakdown.dnf = RACE_POINTS.dnf;
  if (tip.dns && result.dns?.includes(tip.dns)) breakdown.dns = RACE_POINTS.dns;

  return { total: sum(breakdown), breakdown, isPerfect, max };
}

/**
 * Score a sprint tip. Returns { total, breakdown, isPerfect, late? }.
 * Unlike the race, the sprint podium bonus uses the full tipped `podium` array, including podium[0].
 */
export function scoreSprint(tip, result, race) {
  const breakdown = { sprintWinner: 0, sprintP2: 0, sprintP3: 0, sprintPodiumBonus: 0, perfectSprint: 0 };
  if (!tip || !result) return { total: 0, breakdown, isPerfect: false };
  if (isLate(tip.submittedAt, race.sprintStartUTC)) return { total: 0, breakdown, isPerfect: false, late: true };

  const tipped = tip.podium || [];
  const actual = result.podium || [];

  if (tip.winner === result.winner) breakdown.sprintWinner = SPRINT_POINTS.winner;
  if (tipped[1] === actual[1]) breakdown.sprintP2 = SPRINT_POINTS.p2;
  if (tipped[2] === actual[2]) breakdown.sprintP3 = SPRINT_POINTS.p3;
  breakdown.sprintPodiumBonus = podiumBonus(tipped, actual, [breakdown.sprintWinner > 0, breakdown.sprintP2 > 0, breakdown.sprintP3 > 0]);

  const isPerfect = breakdown.sprintWinner > 0 && breakdown.sprintP2 > 0 && breakdown.sprintP3 > 0;
  if (isPerfect) breakdown.perfectSprint = SPRINT_POINTS.perfect;

  return { total: sum(breakdown), breakdown, isPerfect };
}

/** Score the season tip (WDC/WCC) once the final standings are known. */
export function scoreSeason(tip, final) {
  const breakdown = { wdc: 0, wcc: 0 };
  if (!tip || !final) return { total: 0, breakdown };
  if (tip.wdc === final.wdc) breakdown.wdc = SEASON_POINTS.wdc;
  if (tip.wcc === final.wcc) breakdown.wcc = SEASON_POINTS.wcc;
  return { total: breakdown.wdc + breakdown.wcc, breakdown };
}

/** Sort order: points, then correct winners, perfect rounds, correct poles (all descending). */
export function compareStandings(a, b) {
  return (b.totalPoints - a.totalPoints)
    || (b.correctWinners - a.correctWinners)
    || (b.perfectRounds - a.perfectRounds)
    || (b.correctPoles - a.correctPoles);
}

/**
 * Full standings.
 * game = { players, races, raceTips, sprintTips, raceResults, sprintResults, seasonTips, seasonFinal }
 * where raceTips[round][playerId], raceResults[round], sprintTips/sprintResults likewise, seasonTips[playerId].
 * Pass `uptoRound` to compute the standings as they were after that round.
 */
export function calculateStandings(game, { uptoRound = Infinity } = {}) {
  const { players, races, raceTips = {}, sprintTips = {}, raceResults = {}, sprintResults = {}, seasonTips = {}, seasonFinal = null } = game;
  const standings = players.map((player) => {
    const pid = player.id;
    const row = { playerId: pid, totalPoints: 0, racePoints: 0, sprintPoints: 0, seasonPoints: 0, correctWinners: 0, perfectRounds: 0, correctPoles: 0, raceScores: {}, sprintScores: {} };
    for (const race of races) {
      if (race.round > uptoRound) continue;
      const key = String(race.round);
      const result = raceResults[key];
      const tip = raceTips[key]?.[pid];
      if (result && tip) {
        const s = scoreRace(tip, result, race);
        row.raceScores[race.round] = s;
        row.racePoints += s.total;
        if (s.breakdown.winner === RACE_POINTS.winner) row.correctWinners++;
        if (s.isPerfect) row.perfectRounds++;
        if (s.breakdown.pole === RACE_POINTS.pole) row.correctPoles++;
      }
      if (race.sprint) {
        const sResult = sprintResults[key];
        const sTip = sprintTips[key]?.[pid];
        if (sResult && sTip) {
          const s = scoreSprint(sTip, sResult, race);
          row.sprintScores[race.round] = s;
          row.sprintPoints += s.total;
        }
      }
    }
    if (uptoRound === Infinity && seasonTips[pid] && seasonFinal) row.seasonPoints = scoreSeason(seasonTips[pid], seasonFinal).total;
    row.totalPoints = row.racePoints + row.sprintPoints + row.seasonPoints;
    return row;
  });
  return standings.sort(compareStandings);
}

/** Share of the possible points a player earned in the scored races and sprints, in percent. */
export function accuracy(row) {
  const races = Object.values(row.raceScores);
  const sprints = Object.values(row.sprintScores);
  const max = races.reduce((a, s) => a + s.max, 0) + sprints.length * SPRINT_MAX;
  if (max === 0) return 0;
  const earned = races.reduce((a, s) => a + s.total, 0) + sprints.reduce((a, s) => a + s.total, 0);
  return Math.round((earned / max) * 100);
}
