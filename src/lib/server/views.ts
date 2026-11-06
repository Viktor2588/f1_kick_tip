import { calculateAccuracy, calculateStandings, scoreRace, scoreSprint, type RaceScore, type SprintScore, type SeasonGame } from '$lib/scoring';
import { deadlineStatus, nextRace, sprintDeadlineStatus } from '$lib/race';
import type { Race, SeasonData } from '$lib/types';

const CURRENT_SEASON = 2026;
export { CURRENT_SEASON };

function resultRounds(game: SeasonGame) {
  return new Set(Object.keys(game.raceResults).map(Number));
}

/** Standings with rank change since the previous scored round and cumulative points per round. */
export function standingsView(data: SeasonData) {
  const { game } = data;
  const rounds = [...resultRounds(game)].sort((a, b) => a - b);
  const now = calculateStandings(game);

  let previousRank: Record<string, number> = {};
  if (rounds.length > 1) {
    const last = rounds[rounds.length - 1];
    const before = calculateStandings({
      ...game,
      raceResults: Object.fromEntries(Object.entries(game.raceResults).filter(([r]) => Number(r) !== last)),
      sprintResults: Object.fromEntries(Object.entries(game.sprintResults).filter(([r]) => Number(r) !== last)),
    });
    previousRank = Object.fromEntries(before.map((s, i) => [s.playerId, i + 1]));
  }

  // Cumulative points after each scored round (race + sprint of that round)
  const history = data.players.map(p => {
    const st = now.find(s => s.playerId === p.id)!;
    let sum = 0;
    return {
      playerId: p.id,
      points: rounds.map(r => (sum += (st.raceScores[r]?.total ?? 0) + (st.sprintScores[r]?.total ?? 0))),
    };
  });

  const leader = now[0]?.totalPoints ?? 0;
  return {
    rounds,
    history,
    rows: now.map((s, i) => ({
      rank: i + 1,
      change: previousRank[s.playerId] ? previousRank[s.playerId] - (i + 1) : 0,
      player: data.players.find(p => p.id === s.playerId)!,
      totalPoints: s.totalPoints,
      racePoints: s.racePoints,
      sprintPoints: s.sprintPoints,
      seasonPoints: s.seasonPoints,
      gap: leader - s.totalPoints,
      correctWinners: s.correctWinners,
      perfectRounds: s.perfectRounds,
      correctPoles: s.correctPoles,
      accuracy: calculateAccuracy(s.raceScores, s.sprintScores),
    })),
  };
}

export function dashboardView(data: SeasonData, now = new Date()) {
  const { game } = data;
  const done = resultRounds(game);
  const next = nextRace(data.races, done, now);

  const tipStatus = next
    ? data.players.map(p => ({
        player: p,
        race: !!game.raceTips[next.round]?.[p.id],
        sprint: next.sprint ? !!game.sprintTips[next.round]?.[p.id] : null,
      }))
    : [];

  const recent = [...done].sort((a, b) => b - a).slice(0, 3).map(round => {
    const race = data.races.find(r => r.round === round)!;
    const result = game.raceResults[round];
    let best: { playerId: string; points: number } | null = null;
    for (const p of data.players) {
      const tip = game.raceTips[round]?.[p.id];
      if (!tip) continue;
      const pts = scoreRace(tip, result, race).total;
      if (!best || pts > best.points) best = { playerId: p.id, points: pts };
    }
    return {
      race,
      winner: result.winner ?? null,
      best: best ? { player: data.players.find(p => p.id === best!.playerId)!, points: best.points } : null,
    };
  });

  const round1 = data.races.find(r => r.round === 1);
  const seasonRevealed = !round1 || now >= new Date(round1.raceStartUTC);
  const seasonTips = data.players.map(p => {
    const tip = game.seasonTips[p.id];
    return { player: p, submitted: !!tip, wdc: seasonRevealed ? tip?.wdc ?? null : null, wcc: seasonRevealed ? tip?.wcc ?? null : null };
  });

  return {
    next: next ? { race: next, status: deadlineStatus(next, false, now), sprintStatus: sprintDeadlineStatus(next, false, now) } : null,
    completed: done.size,
    totalRaces: data.races.length,
    tipStatus,
    recent,
    seasonTips,
    seasonRevealed,
  };
}

export function calendarView(data: SeasonData, now = new Date()) {
  const done = resultRounds(data.game);
  const next = nextRace(data.races, done, now);
  return data.races.map(r => ({
    race: r,
    state: (done.has(r.round) ? 'finished' : r === next ? 'next' : new Date(r.raceStartUTC) <= now ? 'pending' : 'upcoming') as 'finished' | 'next' | 'pending' | 'upcoming',
  }));
}

type TipCell = { value: string | null; verdict: 'correct' | 'partial' | 'wrong' | null; late: boolean } | { hidden: true } | null;

/** Race detail. Tip contents are only included once the respective deadline has passed. */
export function raceView(data: SeasonData, round: number, now = new Date()) {
  const race = data.races.find(r => r.round === round);
  if (!race) return null;
  const { game } = data;
  const result = game.raceResults[round] ?? null;
  const sprintResult = game.sprintResults[round] ?? null;
  const status = deadlineStatus(race, !!result, now);
  const sprintStatus = sprintDeadlineStatus(race, !!sprintResult, now);
  const raceRevealed = status !== 'open';
  const sprintRevealed = sprintStatus !== null && sprintStatus !== 'open';

  const raceCategories = [
    { key: 'winner', label: 'P1 (Sieger)' },
    { key: 'p2', label: 'P2' },
    { key: 'p3', label: 'P3' },
    { key: 'pole', label: 'Pole Position' },
    { key: 'fastestLap', label: 'Schnellste Runde' },
    { key: 'bestConstructor', label: 'Bester Konstrukteur' },
    ...(!result || result.dnf ? [{ key: 'dnf', label: 'DNF' }, { key: 'dns', label: 'DNS' }] : []),
  ] as const;

  function raceCell(playerId: string, key: (typeof raceCategories)[number]['key']): TipCell {
    const tip = game.raceTips[round]?.[playerId];
    if (!tip) return null;
    if (!raceRevealed) return { hidden: true };
    const value =
      key === 'winner' ? tip.winner : key === 'p2' ? tip.podium?.[1] : key === 'p3' ? tip.podium?.[2] : (tip as Record<string, string | null | undefined>)[key];
    const late = !!tip.submittedAt && new Date(tip.submittedAt) > new Date(race!.raceStartUTC);
    let verdict: 'correct' | 'partial' | 'wrong' | null = null;
    if (result && !late) {
      const resPodium = [result.winner, result.podium?.[1], result.podium?.[2]];
      if (key === 'winner' || key === 'p2' || key === 'p3') {
        const idx = key === 'winner' ? 0 : key === 'p2' ? 1 : 2;
        verdict = value === resPodium[idx] ? 'correct' : value && resPodium.includes(value) ? 'partial' : 'wrong';
      } else if (key === 'dnf' || key === 'dns') {
        verdict = value && result[key]?.includes(value) ? 'correct' : 'wrong';
      } else {
        verdict = value === (result as Record<string, unknown>)[key] ? 'correct' : 'wrong';
      }
    }
    return { value: value || null, verdict, late };
  }

  function sprintCell(playerId: string, idx: number): TipCell {
    const tip = game.sprintTips[round]?.[playerId];
    if (!tip) return null;
    if (!sprintRevealed) return { hidden: true };
    const value = idx === 0 ? tip.winner : tip.podium?.[idx];
    const late = !!tip.submittedAt && !!race!.sprintStartUTC && new Date(tip.submittedAt) > new Date(race!.sprintStartUTC);
    let verdict: 'correct' | 'partial' | 'wrong' | null = null;
    if (sprintResult && !late) {
      const resVal = idx === 0 ? sprintResult.winner : sprintResult.podium?.[idx];
      verdict = value === resVal ? 'correct' : value && sprintResult.podium?.includes(value) ? 'partial' : 'wrong';
    }
    return { value: value || null, verdict, late };
  }

  const scores = data.players.map(p => {
    const raceTip = game.raceTips[round]?.[p.id];
    const sprintTip = game.sprintTips[round]?.[p.id];
    const raceScore: RaceScore | null = result && raceTip ? scoreRace(raceTip, result, race) : null;
    const sprintScore: SprintScore | null = sprintResult && sprintTip ? scoreSprint(sprintTip, sprintResult, race) : null;
    return { player: p, raceScore, sprintScore, total: (raceScore?.total ?? 0) + (sprintScore?.total ?? 0) };
  });

  return {
    race,
    status,
    sprintStatus,
    result,
    sprintResult,
    raceRevealed,
    sprintRevealed,
    raceTable: raceCategories.map(c => ({ ...c, cells: data.players.map(p => raceCell(p.id, c.key)) })),
    sprintTable: race.sprint ? ['Sprint P1', 'Sprint P2', 'Sprint P3'].map((label, i) => ({ label, cells: data.players.map(p => sprintCell(p.id, i)) })) : null,
    hasRaceTips: Object.keys(game.raceTips[round] ?? {}).length > 0,
    hasSprintTips: Object.keys(game.sprintTips[round] ?? {}).length > 0,
    scores: result || sprintResult ? scores : null,
  };
}

export function lookups(data: SeasonData) {
  return {
    drivers: Object.fromEntries(data.drivers.map(d => [d.id, d])),
    teams: Object.fromEntries(data.teams.map(t => [t.id, t])),
  };
}

export type RaceInfo = Race;
