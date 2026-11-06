<script lang="ts">
  import { page } from '$app/state';

  let { id, full = false, team = false }: { id: string | null | undefined; full?: boolean; team?: boolean } = $props();
  const meta = $derived(page.data.meta);
  const driver = $derived(id ? meta.drivers[id] : undefined);
  const t = $derived(team && id ? meta.teams[id] : driver ? meta.teams[driver.teamId] : undefined);
  const label = $derived(
    team ? (t?.name ?? id ?? '–') : driver ? (full ? driver.name : driver.name.split(' ').slice(1).join(' ') || driver.name) : (id || '–'),
  );
</script>

{#if id}<span class="d"><span class="team-bar" style:background={t?.color ?? 'var(--line-strong)'}></span>{label}</span>{:else}<span class="muted">–</span>{/if}

<style>
  .d { white-space: nowrap; }
</style>
