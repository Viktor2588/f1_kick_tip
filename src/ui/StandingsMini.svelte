<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href } from '../lib/router.svelte';
  import Avatar from './Avatar.svelte';

  const rows = $derived(app.standings);
  const leader = $derived(rows[0]?.total ?? 0);
  const medal = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];
</script>

<a class="card flush list mini" href={href('tabelle')}>
  {#each rows as s (s.playerId)}
    {@const p = app.playerById(s.playerId)}
    <div class="r" class:me={s.playerId === app.me}>
      <span class="rank num" style="--m: {medal[s.rank - 1] ?? 'var(--surface-3)'}">{s.rank}</span>
      <Avatar id={s.playerId} size={34} />
      <span class="grow">
        <strong>{p?.name}</strong>
        <span class="faint small">{s.correctWinners} Sieger · {s.accuracy}% Quote</span>
      </span>
      <span class="pts-col num">
        <strong>{s.total}</strong>
        <span class="faint small">{s.total === leader ? 'Pkt' : `−${leader - s.total}`}</span>
      </span>
    </div>
  {/each}
</a>

<style>
  .mini { display: block; }
  .r { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .r.me { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .rank { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 14px; background: var(--m); color: #111; }
  .grow strong { display: block; font-size: 17px; line-height: 1.15; }
  .pts-col { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .pts-col strong { font-size: 24px; font-weight: 900; line-height: 1; }
</style>
