<script lang="ts">
  import { clock } from '$lib/clock.svelte';
  import { countdownParts, pad2 } from '$lib/format';

  let { to }: { to: string } = $props();
  const c = $derived(countdownParts(to, clock.now));
</script>

<div class="cd num" class:urgent={!c.done && c.totalMs < 3_600_000} role="timer" aria-label="Countdown">
  {#if c.done}
    <span class="go">Gestartet</span>
  {:else}
    {#if c.d > 0}<div class="u"><b>{c.d}</b><span>{c.d === 1 ? 'Tag' : 'Tage'}</span></div>{/if}
    <div class="u"><b>{pad2(c.h)}</b><span>Std</span></div>
    <div class="u"><b>{pad2(c.m)}</b><span>Min</span></div>
    <div class="u"><b>{pad2(c.s)}</b><span>Sek</span></div>
  {/if}
</div>

<style>
  .cd { display: flex; gap: 8px; }
  .u {
    min-width: 58px; padding: 8px 6px 6px; border-radius: 12px;
    background: rgb(0 0 0 / 0.28); text-align: center;
    display: flex; flex-direction: column; line-height: 1;
  }
  b { font-size: 1.7rem; font-weight: 900; }
  span { margin-top: 4px; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
  .urgent b { color: #ffd2cf; }
  .go { font-weight: 900; font-size: 1.3rem; }
</style>
