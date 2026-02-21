// ========================================
// F1 Kick Tip 2026 – Scoring Engine
// ========================================

import { isLate } from './utils.js';

/**
 * Score a main race prediction against the result.
 *
 * Returns { total, breakdown, isPerfect }
 *
 * Breakdown keys:
 *   winner (0|3), podiumP2 (0|2), podiumP3 (0|2),
 *   podiumBonus (0-2), pole (0|3), fastestLap (0|3),
 *   bestConstructor (0|3), perfectRound (0|5)
 *
 * Winner = P1 (merged), so no separate podiumP1.
 * Max per race: 3+2+2+3+3+3+5 = 21
 */
export function scoreRace(prediction, result, race) {
  const breakdown = {
    winner: 0,
    podiumP2: 0,
    podiumP3: 0,
    podiumBonus: 0,
    pole: 0,
    fastestLap: 0,
    bestConstructor: 0,
    perfectRound: 0,
  };

  if (!prediction || !result) return { total: 0, breakdown, isPerfect: false };

  // Late submission → 0 points
  if (isLate(prediction.submittedAt, race.raceStartUTC)) {
    return { total: 0, breakdown, isPerfect: false, late: true };
  }

  // Winner = P1 (3 pts)
  if (prediction.winner === result.winner) {
    breakdown.winner = 3;
  }

  // Podium exact positions (P2 & P3 only; P1 = winner)
  const predPodium = prediction.podium || [];
  const resPodium = result.podium || [];

  if (predPodium[1] === resPodium[1]) breakdown.podiumP2 = 2;
  if (predPodium[2] === resPodium[2]) breakdown.podiumP3 = 2;

  // Podium bonus: driver on podium but wrong position (1 pt each, P2/P3 only)
  for (let i = 1; i < 3; i++) {
    const pred = predPodium[i];
    if (!pred) continue;
    const exactOnThisPos =
      (i === 1 && breakdown.podiumP2 > 0) ||
      (i === 2 && breakdown.podiumP3 > 0);
    if (!exactOnThisPos && resPodium.includes(pred)) {
      breakdown.podiumBonus += 1;
    }
  }

  // Pole position (3 pts)
  if (prediction.pole === result.pole) {
    breakdown.pole = 3;
  }

  // Fastest lap (3 pts)
  if (prediction.fastestLap === result.fastestLap) {
    breakdown.fastestLap = 3;
  }

  // Best constructor (3 pts)
  if (prediction.bestConstructor === result.bestConstructor) {
    breakdown.bestConstructor = 3;
  }

  // Perfect round check: ALL categories correct
  // Winner(=P1) + P2 + P3 exact + pole + fastest lap + best constructor
  const isPerfect =
    breakdown.winner === 3 &&
    breakdown.podiumP2 === 2 &&
    breakdown.podiumP3 === 2 &&
    breakdown.pole === 3 &&
    breakdown.fastestLap === 3 &&
    breakdown.bestConstructor === 3;

  if (isPerfect) {
    breakdown.perfectRound = 5;
  }

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { total, breakdown, isPerfect };
}

/**
 * Score a sprint prediction against the result.
 *
 * Returns { total, breakdown, isPerfect }
 *
 * Breakdown keys:
 *   sprintWinner (0|3), sprintP2 (0|1), sprintP3 (0|1),
 *   sprintPodiumBonus (0-3), perfectSprint (0|2)
 */
export function scoreSprint(prediction, result, race) {
  const breakdown = {
    sprintWinner: 0,
    sprintP2: 0,
    sprintP3: 0,
    sprintPodiumBonus: 0,
    perfectSprint: 0,
  };

  if (!prediction || !result) return { total: 0, breakdown, isPerfect: false };

  // Late submission → 0 points
  if (isLate(prediction.submittedAt, race.sprintStartUTC)) {
    return { total: 0, breakdown, isPerfect: false, late: true };
  }

  const predPodium = prediction.podium || [];
  const resPodium = result.podium || [];

  // Sprint winner (3 pts)
  if (prediction.winner === result.winner) {
    breakdown.sprintWinner = 3;
  }

  // Sprint P2 (1 pt)
  if (predPodium[1] === resPodium[1]) {
    breakdown.sprintP2 = 1;
  }

  // Sprint P3 (1 pt)
  if (predPodium[2] === resPodium[2]) {
    breakdown.sprintP3 = 1;
  }

  // Sprint podium bonus: on podium but wrong position
  for (let i = 0; i < 3; i++) {
    const pred = predPodium[i];
    if (!pred) continue;
    const exactOnThisPos =
      (i === 0 && breakdown.sprintWinner > 0) ||
      (i === 1 && breakdown.sprintP2 > 0) ||
      (i === 2 && breakdown.sprintP3 > 0);
    if (!exactOnThisPos && resPodium.includes(pred)) {
      breakdown.sprintPodiumBonus += 1;
    }
  }

  // Perfect sprint: all 3 positions exact
  const isPerfect =
    breakdown.sprintWinner === 3 &&
    breakdown.sprintP2 === 1 &&
    breakdown.sprintP3 === 1;

  if (isPerfect) {
    breakdown.perfectSprint = 2;
  }

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { total, breakdown, isPerfect };
}

/**
 * Score season predictions (WDC/WCC).
 * finalStandings: { wdc: driverId, wcc: teamId } – null if season not finished.
 *
 * Returns { total, breakdown } per player.
 */
export function scoreSeasonPrediction(prediction, finalStandings) {
  const breakdown = { wdc: 0, wcc: 0 };

  if (!prediction || !finalStandings) return { total: 0, breakdown };

  if (prediction.wdc === finalStandings.wdc) {
    breakdown.wdc = 20;
  }

  if (prediction.wcc === finalStandings.wcc) {
    breakdown.wcc = 15;
  }

  return { total: breakdown.wdc + breakdown.wcc, breakdown };
}

/**
 * Check if a race score represents a perfect round.
 */
export function isPerfectRound(breakdown) {
  return breakdown && breakdown.perfectRound === 5;
}

/**
 * Check if a sprint score represents a perfect sprint.
 */
export function isPerfectSprint(breakdown) {
  return breakdown && breakdown.perfectSprint === 2;
}

/**
 * Calculate full standings for all players.
 *
 * Returns an array of player standings sorted by total points (desc):
 * [{ playerId, totalPoints, racePoints, sprintPoints, seasonPoints,
 *    correctWinners, perfectRounds, correctPoles, raceScores, sprintScores }]
 */
export function calculateStandings(season, predictions, sprintPredictions, results, sprintResults, seasonPredictions, finalStandings) {
  const players = season.players;
  const standings = [];

  for (const player of players) {
    const pid = player.id;
    let racePoints = 0;
    let sprintPoints = 0;
    let correctWinners = 0;
    let perfectRounds = 0;
    let correctPoles = 0;
    const raceScores = {};
    const sprintScores = {};

    // Score each race
    for (const race of season.races) {
      const roundStr = String(race.round);
      const result = results.results ? results.results[roundStr] : null;
      const pred = predictions.predictions?.[roundStr]?.[pid] || null;

      if (result && pred) {
        const score = scoreRace(pred, result, race);
        raceScores[race.round] = score;
        racePoints += score.total;
        if (score.breakdown.winner === 3) correctWinners++;
        if (score.isPerfect) perfectRounds++;
        if (score.breakdown.pole === 3) correctPoles++;
      }

      // Sprint scoring
      if (race.sprint) {
        const sprintResult = sprintResults.sprintResults?.[roundStr] || null;
        const sprintPred = sprintPredictions.sprintPredictions?.[roundStr]?.[pid] || null;

        if (sprintResult && sprintPred) {
          const sprintScore = scoreSprint(sprintPred, sprintResult, race);
          sprintScores[race.round] = sprintScore;
          sprintPoints += sprintScore.total;
        }
      }
    }

    // Season predictions
    let seasonPoints = 0;
    const seasonPred = seasonPredictions.seasonPredictions?.[pid] || null;
    if (seasonPred && finalStandings) {
      const seasonScore = scoreSeasonPrediction(seasonPred, finalStandings);
      seasonPoints = seasonScore.total;
    }

    const totalPoints = racePoints + sprintPoints + seasonPoints;

    standings.push({
      playerId: pid,
      totalPoints,
      racePoints,
      sprintPoints,
      seasonPoints,
      correctWinners,
      perfectRounds,
      correctPoles,
      raceScores,
      sprintScores,
    });
  }

  // Sort by total points (desc), then tiebreakers
  standings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.correctWinners !== a.correctWinners) return b.correctWinners - a.correctWinners;
    if (b.perfectRounds !== a.perfectRounds) return b.perfectRounds - a.perfectRounds;
    return b.correctPoles - a.correctPoles;
  });

  return standings;
}

/**
 * Calculate accuracy percentage for a player's race scores.
 * Accuracy = totalPoints / maxPossiblePoints for completed races.
 */
export function calculateAccuracy(raceScores, sprintScores) {
  const raceCount = Object.keys(raceScores).length;
  const sprintCount = Object.keys(sprintScores).length;

  if (raceCount === 0 && sprintCount === 0) return 0;

  const maxRace = raceCount * 21; // max 21 per race
  const maxSprint = sprintCount * 7; // max 7 per sprint
  const maxTotal = maxRace + maxSprint;

  if (maxTotal === 0) return 0;

  const earnedRace = Object.values(raceScores).reduce((sum, s) => sum + s.total, 0);
  const earnedSprint = Object.values(sprintScores).reduce((sum, s) => sum + s.total, 0);

  return Math.round(((earnedRace + earnedSprint) / maxTotal) * 100);
}
