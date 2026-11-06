<script lang="ts">
  import { app } from '../lib/store.svelte';

  // Renders a driver (kind="driver") or a team (kind="team") as a compact colored tag.
  let { id, kind = 'driver', full = false, code = false, state = null }: {
    id: string | null | undefined;
    kind?: 'driver' | 'team';
    full?: boolean;
    /** F1-style three-letter code (VER, HUL, …) for tight tables. */
    code?: boolean;
    state?: 'hit' | 'part' | 'miss' | null;
  } = $props();

  const color = $derived(kind === 'team' ? app.team(id)?.color ?? '#777' : app.driverColor(id));
  const label = $derived(
    !id ? '–'
      : code ? tla(kind === 'team' ? app.team(id)?.name ?? id : app.lastName(id))
      : kind === 'team' ? app.team(id)?.name ?? id
      : full ? app.driver(id)?.name ?? id : app.lastName(id),
  );
  const num = $derived(kind === 'driver' && !code && id ? app.driver(id)?.number : null);
  function tla(name: string) {
    return name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  }
</script>

<span class="tag {state ?? ''}" class:empty={!id} class:code style="--tc: {color}">
  <span class="bar"></span>
  {#if num != null}<span class="no num">{num}</span>{/if}
  <span class="name ellipsis">{label}</span>
</span>

<style>
  .tag {
    display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%;
    font-weight: 600; line-height: 1.2;
  }
  .bar { width: 4px; height: 1.1em; border-radius: 2px; background: var(--tc); flex: none; }
  .no { font-size: 0.78em; font-weight: 800; color: var(--text-3); min-width: 1.4em; }
  .code .name { letter-spacing: 0.04em; font-weight: 800; }
  .empty { color: var(--text-3); }
  .empty .bar { display: none; }
  .hit .name { color: var(--good); }
  .part .name { color: var(--warn); }
  .miss .name { color: var(--text-3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--bad) 60%, transparent); }
</style>
