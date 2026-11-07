<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import PointsChart from '$lib/components/PointsChart.svelte';
  import { season, playerById, flag } from '$lib/domain/season';
  import { pointsProgression } from '$lib/domain/scoring';

  let { data } = $props();
  const prog = $derived(pointsProgression(season, data.standings, data.game));
  const leader = $derived(data.standings[0]);

  // Per-weekend points grid (heat strip): who won which weekend.
  const weekends = $derived(
    prog.rounds.map((round) => {
      const pts = data.standings.map((s) => ({ id: s.playerId, v: (s.raceScores[round]?.total ?? 0) + (s.sprintScores[round]?.total ?? 0) }));
      const best = Math.max(...pts.map((p) => p.v));
      return { round, pts, best };
    }),
  );
  const weekendWins = $derived(
    Object.fromEntries(season.players.map((p) => [p.id, weekends.filter((w) => w.best > 0 && w.pts.find((x) => x.id === p.id)?.v === w.best).length])),
  );
  const maxCell = $derived(Math.max(1, ...weekends.flatMap((w) => w.pts.map((p) => p.v))));
</script>

<svelte:head><title>Tabelle · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Tabelle</h1>
  <p class="page-sub">Gleichstand: mehr richtige Sieger, dann mehr perfekte Runden, dann mehr richtige Poles.</p>

  <div class="cards">
    {#each data.standings as s, i (s.playerId)}
      {@const p = playerById(s.playerId)}
      <article class="card pc" style:--c={p?.color}>
        <div class="top">
          <span class="rank num">{s.rank}.</span>
          <Avatar id={s.playerId} size={40} ring={i === 0} />
          <div class="nm">
            <b>{p?.name}</b>
            <span class="small faint">{i === 0 ? 'Führt' : `${leader.totalPoints - s.totalPoints} Pkt hinter ${playerById(leader.playerId)?.name}`}</span>
          </div>
          <div class="tot num">{s.totalPoints}<span>Pkt</span></div>
        </div>
        <dl class="stats">
          <div><dt>Rennen</dt><dd class="num">{s.racePoints}</dd></div>
          <div><dt>Sprint</dt><dd class="num">{s.sprintPoints}</dd></div>
          <div><dt>Saison</dt><dd class="num">{season.final ? s.seasonPoints : '–'}</dd></div>
          <div><dt>Sieger ✓</dt><dd class="num">{s.correctWinners}</dd></div>
          <div><dt>Perfekt</dt><dd class="num">{s.perfectRounds}</dd></div>
          <div><dt>Pole ✓</dt><dd class="num">{s.correctPoles}</dd></div>
          <div><dt>Quote</dt><dd class="num">{s.accuracy}%</dd></div>
          <div><dt>WE-Siege</dt><dd class="num">{weekendWins[s.playerId]}</dd></div>
        </dl>
      </article>
    {/each}
  </div>

  {#if prog.rounds.length}
    <section class="section">
      <h2 class="section-title">Punkteverlauf</h2>
      <div class="card"><PointsChart rounds={prog.rounds} series={prog.series} /></div>
    </section>

    <section class="section">
      <h2 class="section-title">Punkte pro Wochenende</h2>
      <div class="card heat-wrap">
        <table class="heat">
          <thead>
            <tr><th></th>{#each data.standings as s (s.playerId)}<th><Avatar id={s.playerId} size={24} /></th>{/each}</tr>
          </thead>
          <tbody>
            {#each [...weekends].reverse() as w (w.round)}
              {@const race = season.races.find((r) => r.round === w.round)}
              <tr>
                <th scope="row"><a href="/rennen/{w.round}">{flag(race?.countryCode ?? '')} <span class="small">R{w.round}</span></a></th>
                {#each data.standings as s (s.playerId)}
                  {@const v = w.pts.find((x) => x.id === s.playerId)?.v ?? 0}
                  <td class="num" class:best={v === w.best && v > 0} style:--a={v / maxCell} style:--c={playerById(s.playerId)?.color}>{v}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else}
    <p class="card empty">Noch keine Ergebnisse.</p>
  {/if}
</main>

<style>
  .cards { display: grid; gap: 10px; }
  .pc { border-left: 4px solid var(--c); }
  .top { display: flex; align-items: center; gap: 12px; }
  .rank { font-weight: 900; font-size: 1.2rem; color: var(--text-3); width: 2ch; }
  .nm { flex: 1; display: flex; flex-direction: column; line-height: 1.2; }
  .nm b { font-size: 1.1rem; }
  .tot { font-size: 2rem; font-weight: 900; line-height: 1; display: flex; align-items: baseline; gap: 3px; }
  .tot span { font-size: 0.75rem; color: var(--text-3); }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 0; }
  .stats div { background: var(--surface-2); border-radius: 10px; padding: 6px 8px; }
  dt { font-size: 0.68rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; }
  dd { margin: 0; font-weight: 900; font-size: 1.1rem; }
  .heat-wrap { padding: 8px; }
  .heat { width: 100%; border-collapse: separate; border-spacing: 4px; }
  .heat th { font-weight: 600; text-align: left; }
  .heat thead th { text-align: center; }
  .heat th a { text-decoration: none; white-space: nowrap; }
  .heat td {
    text-align: center; font-weight: 700; border-radius: 8px; padding: 6px 0;
    background: color-mix(in srgb, var(--c) calc(var(--a) * 70%), var(--surface-2));
  }
  .heat td.best { outline: 2px solid var(--gold); outline-offset: -2px; }
</style>
