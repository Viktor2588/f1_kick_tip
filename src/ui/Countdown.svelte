<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { countdownParts } from '../domain/season';
  import { pad } from '../lib/format';

  let { target, compact = false }: { target: string; compact?: boolean } = $props();
  const c = $derived(countdownParts(target, app.now));
  const urgent = $derived(c.totalMs < 3 * 3_600_000);
</script>

{#if compact}
  <span class="compact num" class:urgent>
    {#if c.days}{c.days}T {/if}{pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
  </span>
{:else}
  <div class="cd num" class:urgent role="timer" aria-label="Countdown">
    {#each [[c.days, 'Tage'], [pad(c.hours), 'Std'], [pad(c.minutes), 'Min'], [pad(c.seconds), 'Sek']] as [v, l]}
      <div class="seg"><strong>{v}</strong><span>{l}</span></div>
    {/each}
  </div>
{/if}

<style>
  .cd { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .seg { background: rgb(0 0 0 / 0.28); border-radius: 12px; padding: 8px 4px 6px; text-align: center; border: 1px solid rgb(255 255 255 / 0.08); }
  strong { display: block; font-size: 28px; font-weight: 900; line-height: 1; letter-spacing: -0.02em; }
  span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; font-weight: 700; }
  .urgent strong { color: #ffd166; }
  .compact { font-weight: 800; }
  .compact.urgent { color: var(--warn); }
</style>
