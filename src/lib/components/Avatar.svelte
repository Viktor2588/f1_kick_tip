<script lang="ts">
  import { playerById } from '$lib/domain/season';
  let { id, size = 32, ring = false }: { id: string; size?: number; ring?: boolean } = $props();
  const p = $derived(playerById(id));
</script>

<span class="av" class:ring style:--c={p?.color ?? '#777'} style:--s="{size}px" title={p?.name ?? id} aria-hidden="true">
  {p?.name?.[0] ?? '?'}
</span>

<style>
  .av {
    width: var(--s); height: var(--s); flex: none;
    display: inline-grid; place-items: center;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    font-weight: 900;
    font-size: calc(var(--s) * 0.46);
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
  }
  .ring { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--c); }
</style>
