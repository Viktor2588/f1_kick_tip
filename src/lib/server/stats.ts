import { calculateStandings, scoreRace, scoreSprint } from '$lib/scoring';
import type { SeasonData } from '$lib/types';

const CATEGORIES = [
  { key: 'winner', label: 'Sieger' },
  { key: 'podiumP2', label: 'P2' },
  { key: 'podiumP3', label: 'P3' },
  { key: 'pole', label: 'Pole' },
  { key: 'fastestLap', label: 'Schnellste Runde' },
  { key: 'bestConstructor', label: 'Konstrukteur' },
  { key: 'dnf', label: 'DNF' },
  { key: 'dns', label: 'DNS' },
] as const;

/** Per player: hit rate per category, best round, and a head-to-head matrix of rounds won. */
export function statsView(data: SeasonData) {
  const { game } = data;
  const scored = data.races.filter(r => game.raceResults[r.round]);
  const standings = calculateStandings(game);

  const perPlayer = data.players.map(p => {
    const cats = CATEGORIES.map(c => {
      let hits = 0;
      let tries = 0;
      for (const race of scored) {
        const tip = game.raceTips[race.round]?.[p.id];
        const result = game.raceResults[race.round];
        if (!tip) continue;
        if ((c.key === 'dnf' || c.key === 'dns') && (!result.dnf || !tip[c.key])) continue; // only rounds with lists and a pick
        const score = scoreRace(tip, result, race);
        if (score.late) { tries++; continue; }
        tries++;
        if (score.breakdown[c.key] > 0) hits++;
      }
      return { ...c, hits, tries, rate: tries ? Math.round((hits / tries) * 100) : null };
    });
    const rounds = scored.map(race => {
      const raceTip = game.raceTips[race.round]?.[p.id];
      const sprintTip = game.sprintTips[race.round]?.[p.id];
      const sprintResult = game.sprintResults[race.round];
      return {
        round: race.round,
        country: race.country,
        points: (raceTip ? scoreRace(raceTip, game.raceResults[race.round], race).total : 0) +
          (sprintTip && sprintResult ? scoreSprint(sprintTip, sprintResult, race).total : 0),
        tipped: !!raceTip,
      };
    });
    const best = rounds.reduce<(typeof rounds)[number] | null>((b, r) => (!b || r.points > b.points ? r : b), null);
    const st = standings.find(s => s.playerId === p.id)!;
    return { player: p, cats, best, tipped: rounds.filter(r => r.tipped).length, rounds, perfectRounds: st.perfectRounds, totalPoints: st.totalPoints };
  });

  // Head-to-head: for each pair, in how many scored rounds did A score more than B (race + sprint)
  const h2h = data.players.map(a => ({
    player: a,
    vs: data.players.map(b => {
      if (a.id === b.id) return null;
      const ra = perPlayer.find(x => x.player.id === a.id)!.rounds;
      const rb = perPlayer.find(x => x.player.id === b.id)!.rounds;
      let wins = 0, losses = 0, draws = 0;
      ra.forEach((r, i) => { if (r.points > rb[i].points) wins++; else if (r.points < rb[i].points) losses++; else draws++; });
      return { opponent: b, wins, losses, draws };
    }),
  }));

  return { scoredRounds: scored.length, perPlayer, h2h };
}
