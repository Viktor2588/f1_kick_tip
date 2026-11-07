<script lang="ts">
  import Avatar from './Avatar.svelte';
  import DriverTag from './DriverTag.svelte';
  import { season, playerById } from '$lib/domain/season';
  import type { Matrix } from '$lib/matrix';

  let { matrix, viewer, bonusLabel = '' }: { matrix: Matrix; viewer: string | null; bonusLabel?: string } = $props();
  const players = season.players;
  const hasResult = $derived(matrix.rows.some((r) => r.result));
  const icon = { exact: '✓', bonus: '±', miss: '', open: '', late: '', none: '', hidden: '' } as const;
</script>

<div class="wrap card">
  <table>
    <thead>
      <tr>
        <th class="cat"><span class="sr-only">Kategorie</span></th>
        {#each players as p (p.id)}
          <th class:me={p.id === viewer}>
            <span class="head"><Avatar id={p.id} size={26} /><span class="pname">{p.name}</span></span>
          </th>
        {/each}
        {#if hasResult}<th class="res">Ergebnis</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each matrix.rows as row (row.key)}
        <tr>
          <th scope="row" class="cat">{row.label}</th>
          {#each players as p (p.id)}
            {@const c = row.cells[p.id]}
            <td class="cell {c.state}" class:me={p.id === viewer}>
              {#if c.state === 'hidden'}
                <span class="lock" title="Wird beim Start aufgedeckt">🔒</span>
              {:else if c.state === 'none'}
                <span class="faint">–</span>
              {:else}
                <span class="val"><DriverTag id={c.id} kind={row.kind} size="sm" /></span>
                {#if c.pts > 0}<span class="pts num">+{c.pts}</span>{:else if icon[c.state]}<span class="pts">{icon[c.state]}</span>{/if}
              {/if}
            </td>
          {/each}
          {#if hasResult}
            <td class="res">
              {#if row.result && row.result.length}
                <span class="res-list">{#each row.result as id}<DriverTag {id} kind={row.kind} size="sm" />{/each}</span>
              {:else}<span class="faint">–</span>{/if}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
    {#if hasResult}
      <tfoot>
        <tr>
          <th scope="row" class="cat">Punkte</th>
          {#each players as p (p.id)}
            <td class="total num" class:me={p.id === viewer}>{matrix.totals[p.id] ?? '–'}</td>
          {/each}
          <td class="res"></td>
        </tr>
      </tfoot>
    {/if}
  </table>
  <p class="legend small faint">
    {#if !matrix.revealed}🔒 Tipps der anderen werden beim Start aufgedeckt.{/if}
    {#if hasResult}<span><i class="sw exact"></i>richtig</span> <span><i class="sw bonus"></i>auf dem Podium, falsche Position{bonusLabel}</span>{/if}
  </p>
</div>

<style>
  .wrap { padding: 6px 4px 10px; overflow-x: auto; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
  th, td { padding: 8px 4px; text-align: left; vertical-align: middle; }
  thead th { font-weight: 700; font-size: 0.8rem; color: var(--text-2); }
  .head { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .pname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cat { width: 26%; font-size: 0.78rem; font-weight: 600; color: var(--text-2); line-height: 1.15; padding-left: 10px; }
  .res { width: 21%; }
  thead .res { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
  tbody tr + tr > * { border-top: 1px solid var(--line); }
  .cell { position: relative; border-radius: 8px; }
  .cell .val { display: block; overflow: hidden; }
  .cell.exact { background: var(--good-soft); }
  .cell.bonus { background: var(--part-soft); }
  .cell.miss .val, .cell.late .val { opacity: 0.55; }
  .cell.late .val { text-decoration: line-through; }
  .pts { position: absolute; top: 1px; right: 4px; font-size: 0.66rem; font-weight: 900; }
  .exact .pts { color: var(--good); }
  .bonus .pts { color: var(--part); }
  .lock { display: block; text-align: center; opacity: 0.7; }
  td.me, th.me { background-image: linear-gradient(var(--accent-soft), var(--accent-soft)); }
  .res-list { display: flex; flex-wrap: wrap; gap: 2px 8px; }
  tfoot th, tfoot td { border-top: 2px solid var(--line); }
  .total { font-size: 1.25rem; font-weight: 900; text-align: center; }
  .legend { margin: 8px 10px 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .sw.exact { background: var(--good); }
  .sw.bonus { background: var(--part); }
  @media (max-width: 380px) {
    .pname { display: none; }
  }
</style>
