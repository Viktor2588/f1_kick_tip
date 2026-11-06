<script lang="ts">
  import { page } from '$app/state';
  let { data } = $props();
  const s = $derived(data.stats);
  const icsUrl = $derived(`${page.url.origin}/kalender.ics`);
  const webcal = $derived(icsUrl.replace(/^https?:/, 'webcal:'));
</script>

<svelte:head><title>Statistik – F1 Kick Tip</title></svelte:head>

<h1>Statistik</h1>
<p class="muted small lead">{s.scoredRounds} gewertete Rennen</p>

<section>
  <h2 class="h">Trefferquote je Kategorie</h2>
  <div class="players">
    {#each s.perPlayer as pp}
      <div class="card" style:--pc={pp.player.color}>
        <div class="name">{pp.player.emoji} {pp.player.name}<span class="muted small">{pp.tipped}/{s.scoredRounds} getippt</span></div>
        <ul class="bars">
          {#each pp.cats as c}
            <li>
              <span class="lbl">{c.label}</span>
              <span class="bar" aria-hidden="true"><i style:width="{c.rate ?? 0}%"></i></span>
              <span class="val tnum">{c.rate === null ? '–' : `${c.rate}%`}{#if c.tries}<span class="muted">&nbsp;{c.hits}/{c.tries}</span>{/if}</span>
            </li>
          {/each}
        </ul>
        <div class="facts small">
          {#if pp.best}<span>Beste Runde: <b>{pp.best.points} Pkt.</b> ({pp.best.country})</span>{/if}
          <span>Perfekte Runden: <b>{pp.perfectRounds}</b></span>
        </div>
      </div>
    {/each}
  </div>
</section>

<section>
  <h2 class="h">Direktvergleich</h2>
  <p class="muted small">Gewonnene Rennwochenenden (Rennen + Sprint) gegeneinander: Siege – Unentschieden – Niederlagen.</p>
  <div class="card h2h">
    {#each s.h2h as row}
      {#each row.vs as v}
        {#if v && row.player.id < v.opponent.id}
          <div class="duel">
            <span class="a" style:color={row.player.color}>{row.player.emoji} {row.player.name}</span>
            <span class="score tnum"><b>{v.wins}</b> – {v.draws} – <b>{v.losses}</b></span>
            <span class="b" style:color={v.opponent.color}>{v.opponent.name} {v.opponent.emoji}</span>
          </div>
        {/if}
      {/each}
    {/each}
  </div>
</section>

<section class="card cal">
  <h2>Tipp-Schluss im Kalender</h2>
  <p class="small">Abonniere alle Tipp-Deadlines mit Erinnerung 2 Stunden vorher.</p>
  <div class="row">
    <a class="btn primary" href={webcal}>Kalender abonnieren</a>
    <a class="btn ghost" href="/kalender.ics" download>.ics herunterladen</a>
  </div>
  <p class="muted small">Oder diese Adresse im Kalender als Abo hinzufügen: <code>{icsUrl}</code></p>
</section>

<style>
  .lead { margin: 4px 0 16px; }
  section + section { margin-top: 24px; }
  .h { margin-bottom: 10px; }
  .players { display: grid; gap: 10px; }
  .players .card { border-top: 3px solid var(--pc); }
  .name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .bars { list-style: none; display: grid; gap: 6px; }
  .bars li { display: grid; grid-template-columns: 7.5em 1fr 6.5em; align-items: center; gap: 8px; font-size: 0.85rem; }
  .bar { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--pc); border-radius: 4px; }
  .val { text-align: right; font-weight: 600; }
  .facts { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; color: var(--text-2); }
  .h2h { display: grid; gap: 0; padding: 4px 16px; }
  .duel { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); font-weight: 600; }
  .duel:first-child { border-top: 0; }
  .b { text-align: right; }
  .score { font-family: var(--font-display); font-size: 1.1rem; }
  .cal { margin-top: 24px; display: grid; gap: 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  code { word-break: break-all; font-size: 0.8rem; }
  @media (min-width: 900px) { .players { grid-template-columns: repeat(3, 1fr); } }
</style>
