import type { PlayerId, Round, Season, Snapshot } from './types';
import { scoreRace, scoreSprint, scoreSeason, type Score, type RaceBreakdown, type SprintBreakdown } from './scoring';
import type { RaceSlot } from './rules';

export type CategoryKey = RaceSlot | 'sprintP1';

export interface CategoryStat {
  hits: number;
  attempts: number;
}

export interface PlayerStanding {
  playerId: PlayerId;
  rank: number;
  total: number;
  racePoints: number;
  sprintPoints: number;
  seasonPoints: number;
  correctWinners: number;
  perfectRounds: number;
  correctPoles: number;
  raceScores: Record<Round, Score<RaceBreakdown>>;
  sprintScores: Record<Round, Score<SprintBreakdown>>;
  /** Points earned per scored round (race + sprint of that weekend), in calendar order. */
  perRound: { round: Round; points: number; cumulative: number }[];
  categories: Record<CategoryKey, CategoryStat>;
  /** Points / max over all scored rounds where a tip existed, in percent. */
  accuracy: number;
  best: { round: Round; points: number } | null;
  missedTips: number;
}

const CATS: CategoryKey[] = ['p1', 'p2', 'p3', 'pole', 'fastestLap', 'bestConstructor', 'dnf', 'dns', 'sprintP1'];

export function computeStandings(season: Season, snap: Snapshot): PlayerStanding[] {
  const scoredRaces = season.races.filter((r) => snap.raceResults[r.round] || snap.sprintResults[r.round]);

  const rows = season.players.map((player): PlayerStanding => {
    const pid = player.id;
    const raceScores: PlayerStanding['raceScores'] = {};
    const sprintScores: PlayerStanding['sprintScores'] = {};
    const categories = Object.fromEntries(CATS.map((c) => [c, { hits: 0, attempts: 0 }])) as Record<CategoryKey, CategoryStat>;
    const perRound: PlayerStanding['perRound'] = [];
    let racePoints = 0, sprintPoints = 0, correctWinners = 0, perfectRounds = 0, correctPoles = 0;
    let earned = 0, possible = 0, missedTips = 0;
    let cumulative = 0;

    for (const race of scoredRaces) {
      let roundPoints = 0;
      const result = snap.raceResults[race.round];
      const tip = snap.raceTips[race.round]?.[pid];
      if (result) {
        if (!tip) missedTips++;
        else {
          const s = scoreRace(tip, result, race);
          raceScores[race.round] = s;
          racePoints += s.total;
          roundPoints += s.total;
          earned += s.total;
          possible += s.max;
          if (s.breakdown.p1 > 0) correctWinners++;
          if (s.perfect) perfectRounds++;
          if (s.breakdown.pole > 0) correctPoles++;
          if (!s.late) {
            const b = s.breakdown;
            const bump = (k: CategoryKey, hit: boolean) => { categories[k].attempts++; if (hit) categories[k].hits++; };
            bump('p1', b.p1 > 0);
            bump('p2', b.p2 > 0);
            bump('p3', b.p3 > 0);
            bump('pole', b.pole > 0);
            bump('fastestLap', b.fastestLap > 0);
            bump('bestConstructor', b.bestConstructor > 0);
            if (Array.isArray(result.dnf) && tip.dnf) bump('dnf', b.dnf > 0);
            if (Array.isArray(result.dns) && tip.dns) bump('dns', b.dns > 0);
          }
        }
      }
      const sResult = snap.sprintResults[race.round];
      const sTip = snap.sprintTips[race.round]?.[pid];
      if (race.sprint && sResult && sTip) {
        const s = scoreSprint(sTip, sResult, race);
        sprintScores[race.round] = s;
        sprintPoints += s.total;
        roundPoints += s.total;
        earned += s.total;
        possible += s.max;
        if (!s.late) {
          categories.sprintP1.attempts++;
          if (s.breakdown.p1 > 0) categories.sprintP1.hits++;
        }
      }
      cumulative += roundPoints;
      perRound.push({ round: race.round, points: roundPoints, cumulative });
    }

    const seasonPoints = scoreSeason(snap.seasonTips[pid], season.final).total;
    const best = perRound.reduce<PlayerStanding['best']>(
      (b, r) => (!b || r.points > b.points ? { round: r.round, points: r.points } : b), null);

    return {
      playerId: pid,
      rank: 0,
      total: racePoints + sprintPoints + seasonPoints,
      racePoints, sprintPoints, seasonPoints,
      correctWinners, perfectRounds, correctPoles,
      raceScores, sprintScores, perRound, categories,
      accuracy: possible ? Math.round((earned / possible) * 100) : 0,
      best,
      missedTips,
    };
  });

  rows.sort(compareStandings);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && compareStandings(prev, r) === 0 ? prev.rank : i + 1;
  });
  return rows;
}

export function compareStandings(a: Pick<PlayerStanding, 'total' | 'correctWinners' | 'perfectRounds' | 'correctPoles'>, b: typeof a): number {
  return (b.total - a.total) || (b.correctWinners - a.correctWinners) || (b.perfectRounds - a.perfectRounds) || (b.correctPoles - a.correctPoles);
}

/** Rank of each player after each scored round (points only, ties share a rank). */
export function rankHistory(standings: PlayerStanding[]): Record<PlayerId, number[]> {
  const out: Record<PlayerId, number[]> = {};
  const n = standings[0]?.perRound.length ?? 0;
  for (const s of standings) out[s.playerId] = [];
  for (let i = 0; i < n; i++) {
    const vals = standings.map((s) => s.perRound[i].cumulative);
    for (const s of standings) out[s.playerId].push(1 + vals.filter((v) => v > s.perRound[i].cumulative).length);
  }
  return out;
}
