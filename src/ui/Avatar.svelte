<script lang="ts">
  import { app } from '../lib/store.svelte';

  let { id, size = 36, dim = false, ring = false }: { id: string; size?: number; dim?: boolean; ring?: boolean } = $props();
  const p = $derived(app.playerById(id));
</script>

<span
  class="avatar"
  class:dim
  class:ring
  style="--c: {p?.color ?? '#777'}; width: {size}px; height: {size}px; font-size: {size * 0.5}px"
  title={p?.name ?? id}
  aria-label={p?.name ?? id}
>{p?.emoji ?? id.slice(0, 1).toUpperCase()}</span>

<style>
  .avatar {
    display: inline-grid; place-items: center; flex: none; border-radius: 50%;
    background: color-mix(in srgb, var(--c) 22%, var(--surface-2));
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 70%, transparent);
    line-height: 1;
  }
  .ring { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--c); }
  .dim { filter: grayscale(1); opacity: 0.35; }
</style>
