<script lang="ts">
  import '../app.css';
  import TabBar from '$lib/components/TabBar.svelte';
  import { syncClock } from '$lib/clock.svelte';
  import { nextRace } from '$lib/domain/schedule';
  import { season } from '$lib/domain/season';

  let { data, children } = $props();

  $effect.pre(() => syncClock(data.now));
  const next = $derived(nextRace(season, new Date(data.now)));
</script>

{@render children()}

<TabBar tipHref={next ? `/rennen/${next.round}#tipp` : null} />

{#if data.devMode}
  <div class="devmode" title="Lokale Testdaten (DATA_SOURCE=file)">DEV</div>
{/if}

<style>
  .devmode {
    position: fixed; top: calc(env(safe-area-inset-top) + 6px); left: 6px; z-index: 30;
    font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em;
    padding: 2px 6px; border-radius: 6px; background: var(--part); color: #000; opacity: 0.8;
    pointer-events: none;
  }
</style>
