<script lang="ts">
  import type { Player } from '$lib/types';

  let { rounds, history, players }: { rounds: number[]; history: { playerId: string; points: number[] }[]; players: Player[] } = $props();

  const W = 320, H = 150, P = 6;
  const max = $derived(Math.max(1, ...history.flatMap(h => h.points)));
  const x = (i: number) => (rounds.length <= 1 ? W / 2 : P + (i * (W - 2 * P)) / (rounds.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const color = (id: string) => players.find(p => p.id === id)?.color ?? 'currentColor';
  const name = (id: string) => players.find(p => p.id === id)?.name ?? id;
</script>

{#if rounds.length >= 2}
  <figure>
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Punkteverlauf über die Saison">
      {#each [0.25, 0.5, 0.75, 1] as f}
        <line x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} class="grid" />
      {/each}
      {#each history as h}
        <polyline points={h.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} style:stroke={color(h.playerId)} />
        <circle cx={x(h.points.length - 1)} cy={y(h.points[h.points.length - 1])} r="3.5" style:fill={color(h.playerId)} />
      {/each}
    </svg>
    <figcaption>
      {#each history as h}
        <span><i style:background={color(h.playerId)}></i>{name(h.playerId)}</span>
      {/each}
      <span class="muted">Runde {rounds[0]}–{rounds[rounds.length - 1]}</span>
    </figcaption>
  </figure>
{/if}

<style>
  figure { margin-top: 14px; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  polyline { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
  figcaption { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 0.8rem; }
  figcaption i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
</style>
