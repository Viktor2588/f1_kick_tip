<script lang="ts">
  import { onMount } from 'svelte';
  import { countdownParts } from '$lib/race';

  let { target, compact = false }: { target: string; compact?: boolean } = $props();
  let now = $state(Date.now());
  const parts = $derived(countdownParts(target, now));
  const pad = (n: number) => String(n).padStart(2, '0');

  onMount(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });
</script>

{#if parts.expired}
  <span class="expired">Läuft!</span>
{:else if compact}
  <span class="tnum">{parts.days}T {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}</span>
{:else}
  <div class="cd" role="timer" aria-label="Zeit bis zum Start">
    <div><strong class="tnum">{parts.days}</strong><span>Tage</span></div>
    <div><strong class="tnum">{pad(parts.hours)}</strong><span>Std</span></div>
    <div><strong class="tnum">{pad(parts.minutes)}</strong><span>Min</span></div>
    <div><strong class="tnum">{pad(parts.seconds)}</strong><span>Sek</span></div>
  </div>
{/if}

<style>
  .cd { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 340px; }
  .cd div { background: rgba(0, 0, 0, 0.22); border-radius: 12px; padding: 8px 0; text-align: center; }
  .cd strong { display: block; font-family: var(--font-display); font-size: 1.6rem; font-weight: 900; line-height: 1.05; }
  .cd span { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85; }
  .expired { font-weight: 700; }
</style>
