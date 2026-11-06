<script lang="ts">
  import { enhance } from '$app/forms';
  import { flag, fmtDateShort } from '$lib/race';
  import type { Driver, Team } from '$lib/types';

  let { data, form } = $props();
  const players = $derived(data.meta.players);
  const drivers = $derived(Object.values(data.meta.drivers) as Driver[]);
  const teams = $derived(Object.values(data.meta.teams) as Team[]);
  let copied = $state(false);

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); copied = true; setTimeout(() => (copied = false), 2000); } catch { /* clipboard may be blocked */ }
  }
</script>

<svelte:head><title>Admin – F1 Kick Tip</title></svelte:head>

<h1>Admin</h1>
<p class="muted small lead">Ergebnisse eintragen, Login-Links verteilen, Saison abschließen.</p>

<div class="grid">
  <section class="card">
    <h2>Ergebnisse</h2>
    <ul class="rounds">
      {#each data.rounds as r}
        <li>
          <a href="/admin/rennen/{r.round}" class:todo={r.started && !r.hasResult}>
            <span>{flag(r.countryCode)} <b>{r.round}</b> {r.country}</span>
            <span class="state small">
              {#if r.hasResult}<span class="chip finished">eingetragen</span>
              {:else if r.started}<span class="chip locked">fehlt</span>
              {:else}<span class="muted">{fmtDateShort(r.date)}</span>{/if}
              {#if r.sprint}<span class="chip sprint">S</span>{/if}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <div class="side">
    <section class="card">
      <h2>Login-Links</h2>
      <p class="muted small">Ein neuer Link ersetzt den alten. Schick ihn per Messenger an den Spieler.</p>
      <div class="players">
        {#each players as p}
          <form method="POST" action="?/link" use:enhance>
            <input type="hidden" name="player" value={p.id} />
            <button class="btn ghost" type="submit">{p.emoji} Link für {p.name}</button>
          </form>
        {/each}
      </div>
      {#if form?.link}
        <div class="link">
          <div class="small">Neuer Link für <b>{players.find((p: { id: string }) => p.id === form.linkFor)?.name}</b>:</div>
          <input readonly value={form.link} onfocus={e => e.currentTarget.select()} aria-label="Login-Link" />
          <button class="btn primary" type="button" onclick={() => copy(form.link)}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
        </div>
      {/if}
    </section>

    <section class="card">
      <h2>Saisonende</h2>
      <p class="muted small">Erst am Saisonende eintragen: dann zählen die Saison-Tipps (20 + 15 Punkte).</p>
      <form method="POST" action="?/champions" use:enhance class="champs">
        <label>Weltmeister
          <select name="wdc">
            <option value="">– noch offen –</option>
            {#each drivers as d}<option value={d.id} selected={data.champions?.wdc === d.id}>{d.name}</option>{/each}
          </select>
        </label>
        <label>Konstrukteurs-Weltmeister
          <select name="wcc">
            <option value="">– noch offen –</option>
            {#each teams as t}<option value={t.id} selected={data.champions?.wcc === t.id}>{t.name}</option>{/each}
          </select>
        </label>
        <button class="btn primary" type="submit">Speichern</button>
        {#if form?.championsSaved}<p class="ok small">✓ Gespeichert</p>{/if}
        {#if form?.message}<p class="err small">{form.message}</p>{/if}
      </form>
    </section>
  </div>
</div>

<style>
  .lead { margin: 4px 0 16px; }
  .grid { display: grid; gap: 12px; }
  .side { display: grid; gap: 12px; align-content: start; }
  h2 { margin-bottom: 8px; }
  .rounds { list-style: none; display: grid; }
  .rounds a { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; padding: 6px 4px; border-top: 1px solid var(--line); }
  .rounds li:first-child a { border-top: 0; }
  .rounds a.todo b { color: var(--warn); }
  .state { display: flex; gap: 6px; align-items: center; }
  .players { display: grid; gap: 8px; margin-top: 10px; }
  .players .btn { width: 100%; }
  .link { display: grid; gap: 8px; margin-top: 12px; padding: 12px; background: var(--surface-2); border-radius: 12px; }
  .link input, select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); font: inherit; font-size: 16px; }
  .champs { display: grid; gap: 10px; margin-top: 10px; }
  label { display: grid; gap: 4px; font-size: 0.85rem; font-weight: 600; color: var(--text-2); }
  .ok { color: var(--good); font-weight: 600; }
  .err { color: var(--bad); font-weight: 600; }
  @media (min-width: 900px) { .grid { grid-template-columns: 1.2fr 1fr; align-items: start; } }
</style>
