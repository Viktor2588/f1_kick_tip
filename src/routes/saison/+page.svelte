<script lang="ts">
  import { enhance } from '$app/forms';
  import Countdown from '$lib/components/Countdown.svelte';
  import Driver from '$lib/components/Driver.svelte';
  import { fmtDateTime } from '$lib/race';
  import type { Driver as D, Team } from '$lib/types';

  let { data, form } = $props();
  const drivers = $derived(Object.values(data.meta.drivers) as D[]);
  const teams = $derived(Object.values(data.meta.teams) as Team[]);
</script>

<svelte:head><title>Saison-Tipps – F1 Kick Tip</title></svelte:head>

<h1>Saison-Tipps {data.meta.year}</h1>
<p class="muted small lead">Weltmeister <b>20 Punkte</b>, Konstrukteurs-Weltmeister <b>15 Punkte</b>. Gewertet am Saisonende.</p>

{#if data.open}
  <section class="card open">
    <div class="small">Abgabe bis zum Start von Runde 1 · {data.deadline ? fmtDateTime(data.deadline) : ''} Uhr</div>
    {#if data.deadline}<Countdown target={data.deadline} />{/if}
    {#if data.me}
      <form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="sform">
        <label>Weltmeister
          <select name="wdc"><option value="">– wählen –</option>{#each drivers as d}<option value={d.id} selected={data.mine?.wdc === d.id}>{d.name}</option>{/each}</select>
        </label>
        <label>Konstrukteurs-Weltmeister
          <select name="wcc"><option value="">– wählen –</option>{#each teams as t}<option value={t.id} selected={data.mine?.wcc === t.id}>{t.name}</option>{/each}</select>
        </label>
        <button class="btn primary" type="submit">{data.mine ? 'Tipp aktualisieren' : 'Tipp abgeben'}</button>
        {#if form?.saved}<p class="ok">✓ Gespeichert</p>{/if}
        {#if form?.message}<p class="err">{form.message}</p>{/if}
      </form>
    {:else}
      <p>Öffne deinen persönlichen Link, um zu tippen. <a href="/anmelden">Wie geht das?</a></p>
    {/if}
  </section>
{:else}
  <p class="muted small">Seit dem Start von Runde 1 geschlossen.</p>
{/if}

{#if data.final}
  <section class="card final">
    <h2>Saisonende</h2>
    <dl><dt>Weltmeister</dt><dd><Driver id={data.final.wdc} full /></dd><dt>Konstrukteure</dt><dd><Driver id={data.final.wcc} team /></dd></dl>
  </section>
{/if}

<div class="tips">
  {#each data.tips as t}
    <div class="card" style:--pc={t.player.color}>
      <div class="name">{t.player.emoji} {t.player.name}
        {#if t.points !== null}<span class="pts tnum">{t.points} Pkt.</span>{/if}
      </div>
      {#if !t.submitted}<p class="muted small">Kein Tipp</p>
      {:else if !t.wdc}<p class="muted small">Abgegeben</p>
      {:else}
        <dl>
          <dt>Weltmeister</dt><dd class:hit={data.final?.wdc === t.wdc}><Driver id={t.wdc} full /></dd>
          <dt>Konstrukteure</dt><dd class:hit={data.final?.wcc === t.wcc}><Driver id={t.wcc} team /></dd>
        </dl>
      {/if}
    </div>
  {/each}
</div>

<style>
  .lead { margin: 4px 0 16px; }
  .open { display: grid; gap: 12px; margin-bottom: 16px; background: linear-gradient(135deg, #e10600, #8e0400); color: #fff; border: 0; }
  .open a { color: #fff; text-decoration: underline; }
  .sform { display: grid; gap: 10px; }
  label { display: grid; gap: 4px; font-size: 0.85rem; font-weight: 600; }
  select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 10px; border: 0; background: #fff; color: #111; font: inherit; font-size: 16px; }
  .ok { font-weight: 700; }
  .err { font-weight: 700; background: rgba(0, 0, 0, 0.25); padding: 6px 10px; border-radius: 8px; }
  .final { margin-bottom: 16px; }
  .tips { display: grid; gap: 10px; }
  .tips .card { border-top: 3px solid var(--pc); }
  .name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; display: flex; justify-content: space-between; }
  .pts { color: var(--good); }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-top: 8px; font-size: 0.9rem; }
  dt { color: var(--text-3); }
  dd { text-align: right; font-weight: 600; }
  dd.hit { color: var(--good); }
  @media (min-width: 768px) { .tips { grid-template-columns: repeat(3, 1fr); } }
</style>
