<script lang="ts">
  import Countdown from '$lib/components/Countdown.svelte';
  import Driver from '$lib/components/Driver.svelte';
  import PointsChart from '$lib/components/PointsChart.svelte';
  import { flag, fmtDateTime } from '$lib/race';

  let { data } = $props();
  const dash = $derived(data.dash);
  const table = $derived(data.table);
  const myTip = $derived(!!data.me && !!dash.tipStatus.find(t => t.player.id === data.me?.id)?.race);
</script>

<svelte:head><title>F1 Kick Tip {data.meta.year}</title></svelte:head>

<div class="stack">
  {#if dash.next}
    {@const r = dash.next.race}
    <a class="hero" href="/rennen/{r.round}">
      <div class="eyebrow">Nächstes Rennen · Runde {r.round} {#if r.sprint}<span class="chip sprint">Sprint</span>{/if}</div>
      <h1>{flag(r.countryCode)} {r.name}</h1>
      <p class="meta">{r.circuit} · {fmtDateTime(r.raceStartUTC)} Uhr</p>
      <Countdown target={r.raceStartUTC} />
      <div class="tips">
        {#each dash.tipStatus as t}
          <span class="tipper" class:done={t.race} title={t.race ? 'Getippt' : 'Tipp fehlt'}>
            {t.player.emoji} {t.player.name} {t.race ? '✓' : '· fehlt'}
          </span>
        {/each}
      </div>
      <span class="cta">{dash.next.status === 'open' && data.me ? (myTip ? 'Tipp ansehen / ändern' : 'Jetzt tippen') : 'Zum Rennen'} →</span>
    </a>
  {:else}
    <div class="card"><h2>Saison abgeschlossen</h2></div>
  {/if}

  <section>
    <div class="section-head">
      <h2>Tabelle</h2>
      <span class="muted small">{dash.completed}/{dash.totalRaces} Rennen · <a href="/statistik" class="stat-link">Statistik</a></span>
    </div>
    <div class="card table">
      {#each table.rows as row}
        <div class="row" style:--pc={row.player.color}>
          <span class="rank" class:first={row.rank === 1}>{row.rank}</span>
          <div class="who">
            <div class="name">{row.player.emoji} {row.player.name}
              {#if row.change > 0}<span class="move up" title="{row.change} Platz besser">▲{row.change}</span>{/if}
              {#if row.change < 0}<span class="move down" title="{-row.change} Platz schlechter">▼{-row.change}</span>{/if}
            </div>
            <div class="stats muted small">
              <span><b>{row.accuracy}%</b> Genauigkeit</span>
              <span><b>{row.correctWinners}</b> Sieger</span>
              <span><b>{row.perfectRounds}</b> perfekt</span>
            </div>
          </div>
          <div class="pts">
            <strong class="tnum">{row.totalPoints}</strong>
            <span class="muted small">{row.rank === 1 ? 'Pkt.' : `−${row.gap}`}</span>
          </div>
        </div>
      {/each}
      <PointsChart rounds={table.rounds} history={table.history} players={data.meta.players} />
    </div>
  </section>

  {#if dash.recent.length}
    <section>
      <div class="section-head"><h2>Letzte Ergebnisse</h2><a href="/rennen">Alle Rennen</a></div>
      <div class="recent">
        {#each dash.recent as item}
          <a class="card res" href="/rennen/{item.race.round}">
            <div class="muted small">Runde {item.race.round}</div>
            <div class="res-name">{flag(item.race.countryCode)} {item.race.country}</div>
            <div class="small">🏆 <Driver id={item.winner} /></div>
            {#if item.best}<div class="best small">Bester Tipp: {item.best.player.emoji} {item.best.player.name} · {item.best.points} Pkt.</div>{/if}
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <div class="section-head"><h2>Saison-Tipps</h2></div>
    {#if !dash.seasonRevealed}<p class="muted small">Werden nach dem Start von Runde 1 aufgedeckt.</p>{/if}
    <div class="season">
      {#each dash.seasonTips as s}
        <div class="card">
          <div class="name">{s.player.emoji} {s.player.name}</div>
          {#if !s.submitted}
            <p class="muted small">Kein Tipp</p>
          {:else if !dash.seasonRevealed}
            <p class="muted small">Abgegeben</p>
          {:else}
            <dl>
              <dt>Weltmeister</dt><dd><Driver id={s.wdc} full /></dd>
              <dt>Konstrukteure</dt><dd><Driver id={s.wcc} team /></dd>
            </dl>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .hero {
    display: block; border-radius: 22px; padding: 22px 18px; color: #fff;
    background: radial-gradient(120% 90% at 100% 0%, rgba(255, 140, 0, 0.35), transparent 60%), linear-gradient(135deg, #e10600, #8e0400);
    box-shadow: var(--shadow);
  }
  .eyebrow { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9; }
  .hero h1 { margin: 8px 0 4px; font-size: 1.65rem; }
  .meta { font-size: 0.9rem; opacity: 0.9; margin-bottom: 14px; }
  .tips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .tipper { background: rgba(0, 0, 0, 0.25); border-radius: 999px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600; opacity: 0.8; }
  .tipper.done { background: rgba(255, 255, 255, 0.95); color: #8e0400; opacity: 1; }
  .cta { display: inline-block; margin-top: 16px; background: #fff; color: #a00400; font-weight: 700; padding: 9px 16px; border-radius: 999px; font-size: 0.9rem; }

  .table { padding: 6px 16px 16px; }
  .row { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .row:last-of-type { border-bottom: 0; }
  .rank { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-family: var(--font-display); font-weight: 900; color: var(--text-2); box-shadow: inset 0 0 0 2px var(--pc); }
  .rank.first { background: var(--gold-bg); color: var(--gold); }
  .name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
  .stats { display: flex; flex-wrap: wrap; gap: 2px 12px; }
  .stats b { color: var(--text); }
  .move { font-size: 0.72rem; font-weight: 700; }
  .stat-link { color: var(--accent-text); font-weight: 600; }
  .move.up { color: var(--good); }
  .move.down { color: var(--bad); }
  .pts { text-align: right; }
  .pts strong { display: block; font-family: var(--font-display); font-size: 1.6rem; font-weight: 900; line-height: 1; color: var(--pc); }

  .recent { display: grid; gap: 10px; }
  .res { display: grid; gap: 2px; }
  .res-name { font-weight: 700; }
  .best { color: var(--good); font-weight: 600; margin-top: 4px; }

  .season { display: grid; gap: 10px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-top: 8px; font-size: 0.9rem; }
  dt { color: var(--text-3); }
  dd { font-weight: 600; text-align: right; }

  @media (min-width: 768px) {
    .hero { padding: 32px; }
    .hero h1 { font-size: 2.3rem; }
    .recent, .season { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 960px) {
    .stack { display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: start; }
    .stack > * + * { margin-top: 0; }
    .stack > :first-child { grid-column: 1 / -1; }
    .stack > section:nth-of-type(1) { grid-row: span 2; }
    .recent, .season { grid-template-columns: 1fr; }
  }
</style>
