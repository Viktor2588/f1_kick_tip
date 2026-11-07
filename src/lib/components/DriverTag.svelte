<script lang="ts">
  import { code, driverById, lastName, teamById, teamColor, teamColorOfDriver } from '$lib/domain/season';

  let { id, kind = 'driver', size = 'md', full = false }: {
    id: string | null | undefined;
    kind?: 'driver' | 'team';
    size?: 'sm' | 'md';
    full?: boolean;
  } = $props();

  const color = $derived(kind === 'team' ? teamColor(id) : teamColorOfDriver(id));
  const label = $derived(
    !id ? '–' : kind === 'team' ? (teamById(id)?.name ?? id) : full ? lastName(id) : code(id),
  );
  const title = $derived(kind === 'team' ? teamById(id)?.name : driverById(id)?.name);
</script>

<span class="tag {size}" class:empty={!id} style:--c={color} {title}>{label}</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .tag::before {
    content: '';
    width: 4px;
    height: 1.05em;
    border-radius: 2px;
    background: var(--c);
    flex: none;
  }
  .tag.empty { color: var(--text-3); }
  .tag.empty::before { background: var(--line); }
  .sm { font-size: 0.85rem; }
</style>
