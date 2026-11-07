// Neon Postgres store. Uses the exact tables and columns of the legacy app, so the new app can
// run against the live database without a migration. Empty picks are stored as '' like before.

import { neon } from '@neondatabase/serverless';
import type { GameData } from '$lib/domain/types';
import {
  raceResultFromLegacy, raceTipFromLegacy, seasonTipFromLegacy, sprintResultFromLegacy, sprintTipFromLegacy,
} from './legacy-format';
import type { Store } from './types';

type Row = Record<string, unknown>;
const s = (v: string | null | undefined) => v ?? '';

export function neonStore(url: string): Store {
  const sql = neon(url);

  return {
    async load(): Promise<GameData> {
      const [rp, sp, se, rr, sr] = (await sql.transaction([
        sql`SELECT * FROM race_predictions`,
        sql`SELECT * FROM sprint_predictions`,
        sql`SELECT * FROM season_predictions`,
        sql`SELECT * FROM race_results`,
        sql`SELECT * FROM sprint_results`,
      ])) as Row[][];
      const podium = (r: Row) => [r.podium_p1, r.podium_p2, r.podium_p3] as string[];
      const data: GameData = { raceTips: {}, sprintTips: {}, seasonTips: {}, raceResults: {}, sprintResults: {} };
      for (const r of rp) {
        (data.raceTips[String(r.round)] ??= {})[r.player_id as string] = raceTipFromLegacy({
          winner: r.winner as string, podium: podium(r), pole: r.pole as string, fastestLap: r.fastest_lap as string,
          bestConstructor: r.best_constructor as string, dnf: r.dnf as string, dns: r.dns as string, submittedAt: r.submitted_at as string,
        });
      }
      for (const r of sp) {
        (data.sprintTips[String(r.round)] ??= {})[r.player_id as string] = sprintTipFromLegacy({
          winner: r.winner as string, podium: podium(r), submittedAt: r.submitted_at as string,
        });
      }
      for (const r of se) {
        data.seasonTips[r.player_id as string] = seasonTipFromLegacy({ wdc: r.wdc as string, wcc: r.wcc as string, submittedAt: r.submitted_at as string });
      }
      for (const r of rr) {
        data.raceResults[String(r.round)] = raceResultFromLegacy({
          winner: r.winner as string, podium: podium(r), pole: r.pole as string, fastestLap: r.fastest_lap as string,
          bestConstructor: r.best_constructor as string, topTen: r.top_ten as string[] | null,
          dnf: r.dnf as string[] | null, dns: r.dns as string[] | null, enteredAt: r.entered_at as string,
        });
      }
      for (const r of sr) {
        data.sprintResults[String(r.round)] = sprintResultFromLegacy({ winner: r.winner as string, podium: podium(r), enteredAt: r.entered_at as string });
      }
      return data;
    },

    async saveRaceTip(round, playerId, t) {
      const [p1, p2, p3] = t.podium;
      await sql`INSERT INTO race_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, dnf, dns, submitted_at)
        VALUES (${round}, ${playerId}, ${s(p1)}, ${s(p1)}, ${s(p2)}, ${s(p3)}, ${s(t.pole)}, ${s(t.fastestLap)}, ${s(t.bestConstructor)}, ${s(t.dnf)}, ${s(t.dns)}, ${t.submittedAt})
        ON CONFLICT (round, player_id) DO UPDATE SET
          winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
          pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap, best_constructor = EXCLUDED.best_constructor,
          dnf = EXCLUDED.dnf, dns = EXCLUDED.dns, submitted_at = EXCLUDED.submitted_at`;
    },

    async saveSprintTip(round, playerId, t) {
      const [p1, p2, p3] = t.podium;
      await sql`INSERT INTO sprint_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, submitted_at)
        VALUES (${round}, ${playerId}, ${s(p1)}, ${s(p1)}, ${s(p2)}, ${s(p3)}, ${t.submittedAt})
        ON CONFLICT (round, player_id) DO UPDATE SET
          winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
          podium_p3 = EXCLUDED.podium_p3, submitted_at = EXCLUDED.submitted_at`;
    },

    async saveSeasonTip(playerId, t) {
      await sql`INSERT INTO season_predictions (player_id, wdc, wcc, submitted_at) VALUES (${playerId}, ${t.wdc}, ${t.wcc}, ${t.submittedAt})
        ON CONFLICT (player_id) DO UPDATE SET wdc = EXCLUDED.wdc, wcc = EXCLUDED.wcc, submitted_at = EXCLUDED.submitted_at`;
    },

    async saveRaceResult(round, r) {
      const [p1, p2, p3] = r.podium;
      await sql`INSERT INTO race_results (round, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, top_ten, dnf, dns, entered_at)
        VALUES (${round}, ${s(p1)}, ${s(p1)}, ${s(p2)}, ${s(p3)}, ${s(r.pole)}, ${s(r.fastestLap)}, ${s(r.bestConstructor)},
                ${r.topTen}, ${r.dnf}, ${r.dns}, ${r.enteredAt})
        ON CONFLICT (round) DO UPDATE SET
          winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
          pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap, best_constructor = EXCLUDED.best_constructor,
          top_ten = EXCLUDED.top_ten, dnf = EXCLUDED.dnf, dns = EXCLUDED.dns, entered_at = EXCLUDED.entered_at`;
    },

    async deleteRaceResult(round) {
      await sql`DELETE FROM race_results WHERE round = ${round}`;
    },

    async saveSprintResult(round, r) {
      const [p1, p2, p3] = r.podium;
      await sql`INSERT INTO sprint_results (round, winner, podium_p1, podium_p2, podium_p3, entered_at)
        VALUES (${round}, ${s(p1)}, ${s(p1)}, ${s(p2)}, ${s(p3)}, ${r.enteredAt})
        ON CONFLICT (round) DO UPDATE SET
          winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
          podium_p3 = EXCLUDED.podium_p3, entered_at = EXCLUDED.entered_at`;
    },

    async deleteSprintResult(round) {
      await sql`DELETE FROM sprint_results WHERE round = ${round}`;
    },
  };
}
