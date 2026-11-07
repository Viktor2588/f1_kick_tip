<script lang="ts">
  import { season, flag } from '$lib/domain/season';
  import { clock } from '$lib/clock.svelte';
  import { fmtDate } from '$lib/format';

  let { data } = $props();
  const now = $derived(clock.now);
  const rows = $derived(
    season.races.map((r) => {
      const k = String(r.round);
      const started = now >= Date.parse(r.raceStartUTC);
      const has = !!data.game.raceResults[k];
      const sprintMissing = r.sprint && r.sprintStartUTC && now >= Date.parse(r.sprintStartUTC) && !data.game.sprintResults[k];
      return { r, started, has, sprintMissing, todo: (started && !has) || sprintMissing };
    }),
  );
  const todo = $derived(rows.filter((x) => x.todo));
</script>

<svelte:head><title>Admin · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Ergebnisse</h1>
  <p class="page-sub">Ergebnis öffnen, „Von F1-API laden“, prüfen, speichern.</p>

  {#if todo.length}
    <section class="section">
      <h2 class="section-title">Zu erledigen</h2>
      <div class="list">
        {#each todo as x (x.r.round)}
          <a class="row todo" href="/admin/{x.r.round}">
            <span>{flag(x.r.countryCode)} R{x.r.round} {x.r.country}</span>
            <span class="chip chip-accent">{!x.has && x.started ? 'Rennergebnis fehlt' : 'Sprint fehlt'}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">Alle Runden</h2>
    <div class="list">
      {#each rows as x (x.r.round)}
        <a class="row" href="/admin/{x.r.round}">
          <span>{flag(x.r.countryCode)} R{x.r.round} {x.r.country} <span class="faint small">{fmtDate(x.r.raceStartUTC)}</span></span>
          {#if x.has}<span class="chip chip-good">✓</span>{:else if x.started}<span class="chip chip-part">offen</span>{:else}<span class="chip">später</span>{/if}
        </a>
      {/each}
    </div>
  </section>
</main>

<style>
  .list { display: grid; gap: 6px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); text-decoration: none; }
  .row.todo { border-color: var(--accent); }
</style>
