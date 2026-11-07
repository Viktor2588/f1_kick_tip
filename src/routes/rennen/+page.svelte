<script lang="ts">
  import { season, flag } from '$lib/domain/season';
  import { nextRace, weekendStatus } from '$lib/domain/schedule';
  import { clock } from '$lib/clock.svelte';
  import { fmtDate } from '$lib/format';

  let { data } = $props();
  const now = $derived(new Date(clock.now));
  const next = $derived(nextRace(season, now));
  const me = $derived(data.standings.find((s) => s.playerId === data.viewer));

  const rows = $derived(
    season.races.map((race) => {
      const key = String(race.round);
      const status = weekendStatus(race, data.game, now, next);
      const tipped = !!(data.viewer && data.game.raceTips[key]?.[data.viewer]);
      const count = Object.keys(data.game.raceTips[key] ?? {}).length;
      const pts = me ? (me.raceScores[race.round]?.total ?? 0) + (me.sprintScores[race.round]?.total ?? 0) : null;
      return { race, status, tipped, count, pts };
    }),
  );
  const done = $derived(rows.filter((r) => r.status === 'finished').length);
</script>

<svelte:head><title>Kalender · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Kalender {season.season}</h1>
  <p class="page-sub">{done} von {season.races.length} Rennen ausgewertet</p>
  <div class="progress" aria-hidden="true"><span style:width="{(done / season.races.length) * 100}%"></span></div>

  <ol class="list">
    {#each rows as r (r.race.round)}
      <li>
        <a href="/rennen/{r.race.round}" class="row {r.status}">
          <span class="rd num">{r.race.round}</span>
          <span class="fl" aria-hidden="true">{flag(r.race.countryCode)}</span>
          <span class="main">
            <span class="name">{r.race.country}{#if r.race.sprint}<span class="spr">S</span>{/if}</span>
            <span class="sub small">{fmtDate(r.race.raceStartUTC)} · {r.race.city}</span>
          </span>
          <span class="end">
            {#if r.status === 'finished'}
              {#if r.pts !== null}<b class="num">+{r.pts}</b>{:else}<span class="chip chip-good">✓</span>{/if}
            {:else if r.status === 'open'}
              <span class="chip {r.tipped ? 'chip-good' : 'chip-accent'}">{r.tipped ? '✓ getippt' : 'Tippen!'}</span>
            {:else if r.status === 'live'}
              <span class="chip chip-accent">Live</span>
            {:else if r.status === 'awaiting'}
              <span class="chip chip-part">Ergebnis folgt</span>
            {:else if r.tipped}
              <span class="chip">✓ getippt</span>
            {/if}
          </span>
        </a>
      </li>
    {/each}
  </ol>
</main>

<style>
  .progress { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; margin-bottom: 16px; }
  .progress span { display: block; height: 100%; background: var(--accent); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .row {
    display: grid; grid-template-columns: 2ch auto 1fr auto; align-items: center; gap: 12px;
    padding: 12px 14px; border-radius: 14px; text-decoration: none;
    background: var(--surface); border: 1px solid var(--line);
  }
  .row.finished { background: transparent; }
  .row.finished .fl, .row.finished .name { opacity: 0.75; }
  .row.open { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .rd { color: var(--text-3); font-weight: 900; text-align: right; }
  .fl { font-size: 1.5rem; }
  .main { display: flex; flex-direction: column; min-width: 0; }
  .name { font-weight: 700; }
  .spr { margin-left: 6px; font-size: 0.65rem; font-weight: 900; padding: 1px 5px; border-radius: 4px; background: var(--surface-2); color: var(--text-2); vertical-align: 2px; }
  .sub { color: var(--text-3); }
  .end b { font-size: 1.05rem; }
</style>
