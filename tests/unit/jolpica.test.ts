// Importer against a recorded Jolpica response (2026 R19, Mexico City).
import { describe, expect, it } from 'vitest';
import { bestConstructorOf, importRace } from '../../src/lib/server/jolpica';
import results from './fixtures/jolpica-2026-19-results.json';
import quali from './fixtures/jolpica-2026-19-qualifying.json';

const fakeFetch = (async (url: string) => {
  const body = url.includes('qualifying') ? quali : results;
  return new Response(JSON.stringify(body), { status: 200 });
}) as unknown as typeof fetch;

describe('jolpica import', () => {
  it('maps the Mexico City result to our ids', async () => {
    const r = await importRace(19, fakeFetch);
    expect(r).not.toBeNull();
    expect(r!.warnings).toEqual([]);
    expect(r!.podium).toEqual(['verstappen', 'hamilton', 'antonelli']);
    expect(r!.pole).toBe('hamilton');
    expect(r!.fastestLap).toBe('hamilton');
    // Ferrari 18+12 = 30 beats Red Bull 25+2 = 27 and Mercedes 15+8 = 23.
    expect(r!.bestConstructor).toBe('ferrari');
    expect(r!.dnf.sort()).toEqual(['alonso', 'bearman', 'bottas', 'lindblad', 'stroll']);
    expect(r!.dns).toEqual([]);
    expect(r!.topTen).toHaveLength(10);
    expect(r!.topTen).toContain('hirakawa');
  });

  it('best constructor tie goes to the better single finish', () => {
    expect(bestConstructorOf([
      { team: 'a', points: 18, position: 2 }, { team: 'b', points: 15, position: 3 }, { team: 'b', points: 3, position: 1 },
    ])).toBe('b');
  });
});
