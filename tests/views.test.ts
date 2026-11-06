import { describe, expect, it } from 'vitest';
import { openDb } from '../src/lib/server/db';
import { importLegacyRows, importSeason } from '../src/lib/server/db/import';
import { seasonFile } from '../src/lib/server/db/seed';
import { loadSeason } from '../src/lib/server/season';
import { dashboardView, raceView, standingsView } from '../src/lib/server/views';

async function seasonWithOpenRaceTips() {
  const season = seasonFile();
  const db = await openDb();
  await importSeason(db, season);
  await importLegacyRows(db, season.season, {
    race_predictions: [{ round: 20, player_id: 'julia', winner: 'hulkenberg', podium_p1: 'hulkenberg', podium_p2: 'bortoleto', podium_p3: 'gasly', pole: 'colapinto', fastest_lap: 'bearman', best_constructor: 'audi', dnf: 'ocon', dns: 'lawson', submitted_at: '2026-11-01T10:00:00Z' }],
    sprint_predictions: [], season_predictions: [], race_results: [], sprint_results: [],
  });
  return loadSeason(db, season.season);
}

describe('tip secrecy before the deadline', () => {
  it('race page before race start contains no tip contents', async () => {
    const data = await seasonWithOpenRaceTips();
    const beforeStart = new Date('2026-11-07T12:00:00Z');
    const view = raceView(data, 20, beforeStart)!;
    expect(view.status).toBe('open');
    expect(view.raceRevealed).toBe(false);
    const json = JSON.stringify(view);
    for (const secret of ['hulkenberg', 'bortoleto', 'colapinto', 'bearman', 'audi', 'ocon', 'lawson']) expect(json).not.toContain(secret);
    expect(view.raceTable[0].cells).toContainEqual({ hidden: true });
  });

  it('race page after race start shows the tips', async () => {
    const data = await seasonWithOpenRaceTips();
    const afterStart = new Date('2026-11-08T18:00:01Z');
    const view = raceView(data, 20, afterStart)!;
    expect(view.raceRevealed).toBe(true);
    expect(JSON.stringify(view)).toContain('hulkenberg');
  });

  it('dashboard only says who has tipped, not what', async () => {
    const data = await seasonWithOpenRaceTips();
    const dash = dashboardView(data, new Date('2026-11-07T12:00:00Z'));
    expect(dash.next?.race.round).toBe(20);
    expect(dash.tipStatus.find(t => t.player.id === 'julia')?.race).toBe(true);
    const json = JSON.stringify({ dash, table: standingsView(data) });
    expect(json).not.toContain('hulkenberg');
  });
});
