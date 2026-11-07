// JSON-file store for development and end-to-end tests. One file (game.json) in DATA_DIR,
// seeded from a fixture directory on first use. Writes are serialized and atomic.

import { mkdir, readFile, rename, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { GameData } from '$lib/domain/types';
import { emptyGameData } from '$lib/domain/types';
import type { Store } from './types';

export function fileStore(dir: string, seedFile?: string): Store {
  const path = join(dir, 'game.json');
  let chain: Promise<unknown> = Promise.resolve();

  async function read(): Promise<GameData> {
    try {
      await access(path);
    } catch {
      await mkdir(dir, { recursive: true });
      const seed = seedFile ? await readFile(seedFile, 'utf8').catch(() => null) : null;
      await writeFile(path, seed ?? JSON.stringify(emptyGameData(), null, 2));
    }
    return { ...emptyGameData(), ...JSON.parse(await readFile(path, 'utf8')) };
  }

  function update(fn: (d: GameData) => void): Promise<void> {
    const next = chain.then(async () => {
      const data = await read();
      fn(data);
      const tmp = `${path}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, path);
    });
    chain = next.catch(() => {});
    return next;
  }

  return {
    load: () => chain.then(read),
    saveRaceTip: (round, p, tip) => update((d) => { (d.raceTips[round] ??= {})[p] = tip; }),
    saveSprintTip: (round, p, tip) => update((d) => { (d.sprintTips[round] ??= {})[p] = tip; }),
    saveSeasonTip: (p, tip) => update((d) => { d.seasonTips[p] = tip; }),
    saveRaceResult: (round, r) => update((d) => { d.raceResults[round] = r; }),
    deleteRaceResult: (round) => update((d) => { delete d.raceResults[round]; }),
    saveSprintResult: (round, r) => update((d) => { d.sprintResults[round] = r; }),
    deleteSprintResult: (round) => update((d) => { delete d.sprintResults[round]; }),
  };
}
