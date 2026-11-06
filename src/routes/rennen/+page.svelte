<script lang="ts">
  import { flag, fmtDateShort } from '$lib/race';
  let { data } = $props();
  const label = { finished: 'Gewertet', next: 'Nächstes', pending: 'Wartet auf Ergebnis', upcoming: '' } as const;
</script>

<svelte:head><title>Rennkalender – F1 Kick Tip</title></svelte:head>

<h1>Rennkalender {data.meta.year}</h1>
<p class="muted small sub">{data.calendar.filter(c => c.state === 'finished').length} von {data.calendar.length} Rennen gewertet</p>

<ol class="cal">
  {#each data.calendar as { race, state }}
    <li>
      <a href="/rennen/{race.round}" class="item {state}" aria-current={state === 'next' ? 'true' : undefined}>
        <span class="flag" aria-hidden="true">{flag(race.countryCode)}</span>
        <span class="main">
          <span class="country">{race.country}</span>
          <span class="muted small">{label[state] ? `Runde ${race.round} · ${label[state]}` : `Runde ${race.round}`}</span>
        </span>
        <span class="side">
          <span class="date small">{fmtDateShort(race.date)}</span>
          {#if race.sprint}<span class="chip sprint">Sprint</span>{/if}
        </span>
      </a>
    </li>
  {/each}
</ol>

<style>
  .sub { margin: 4px 0 16px; }
  .cal { list-style: none; display: grid; gap: 6px; }
  .item {
    display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: center;
    padding: 10px 14px 10px 12px; background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--line-strong); border-radius: 12px;
  }
  .item:hover { background: var(--surface-2); }
  .item.finished { border-left-color: var(--info); }
  .item.pending { border-left-color: var(--warn); }
  .item.next { border-left-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .item.upcoming { opacity: 0.85; }
  .flag { font-size: 1.5rem; text-align: center; }
  .main { display: grid; min-width: 0; }
  .country { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .side { display: grid; justify-items: end; gap: 4px; }
  .date { color: var(--text-2); white-space: nowrap; }
  @media (min-width: 640px) { .cal { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .cal { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
</style>
