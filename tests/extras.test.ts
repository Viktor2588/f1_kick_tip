import { describe, expect, it } from 'vitest';
import { openDb } from '../src/lib/server/db';
import { importLegacyRows, importSeason, legacyDataToRows } from '../src/lib/server/db/import';
import { demoData, seasonFile } from '../src/lib/server/db/seed';
import { loadSeason } from '../src/lib/server/season';
import { statsView } from '../src/lib/server/stats';
import { tipDeadlineCalendar } from '../src/lib/ics';
import { calculateStandings } from '../src/lib/scoring';

async function demo() {
  const db = await openDb();
  const season = seasonFile();
  await importSeason(db, season);
  await importLegacyRows(db, season.season, legacyDataToRows(demoData()));
  return loadSeason(db, season.season);
}

describe('ICS tip-deadline feed', () => {
  it('has one event per race and per sprint at the start time, with a 2 h reminder', async () => {
    const data = await demo();
    const ics = tipDeadlineCalendar(data.races, data.year, 'https://kick.example', new Date('2026-11-07T00:00:00Z'));
    const events = ics.split('BEGIN:VEVENT').length - 1;
    expect(events).toBe(data.races.length + data.races.filter(r => r.sprint && r.sprintStartUTC).length);
    expect(ics).toContain('DTSTART:20261108T170000Z'); // Brazil race start
    expect(ics.match(/TRIGGER:-PT2H/g)?.length).toBe(events);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics).toContain('URL:https://kick.example/rennen/20');
  });
});

describe('stats', () => {
  it('hit rates and head-to-head are consistent with the standings', async () => {
    const data = await demo();
    const s = statsView(data);
    const st = calculateStandings(data.game);
    expect(s.scoredRounds).toBe(4);
    for (const pp of s.perPlayer) {
      const winner = pp.cats.find(c => c.key === 'winner')!;
      expect(winner.hits).toBe(st.find(x => x.playerId === pp.player.id)!.correctWinners);
      expect(pp.rounds.reduce((a, r) => a + r.points, 0)).toBe(st.find(x => x.playerId === pp.player.id)!.racePoints + st.find(x => x.playerId === pp.player.id)!.sprintPoints);
    }
    // head-to-head is antisymmetric
    for (const row of s.h2h) for (const v of row.vs) {
      if (!v) continue;
      const back = s.h2h.find(r => r.player.id === v.opponent.id)!.vs.find(x => x?.opponent.id === row.player.id)!;
      expect([v.wins, v.draws, v.losses]).toEqual([back.losses, back.draws, back.wins]);
      expect(v.wins + v.draws + v.losses).toBe(4);
    }
  });
});
