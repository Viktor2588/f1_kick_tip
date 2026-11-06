<script lang="ts">
  import { app } from '../lib/store.svelte';
  import Avatar from './Avatar.svelte';
  import Sheet from './Sheet.svelte';
  import { buzz } from '../lib/toast.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  function pick(id: string) {
    app.setMe(id);
    buzz();
    open = false;
  }
</script>

<Sheet bind:open title="Wer bist du?">
  <p class="muted small lead">Einmal wählen, dein Handy merkt es sich. Wechseln kannst du jederzeit oben rechts.</p>
  <div class="grid">
    {#each app.season.players as p (p.id)}
      <button class="pl" class:sel={app.me === p.id} style="--c: {p.color}" onclick={() => pick(p.id)}>
        <Avatar id={p.id} size={64} />
        <strong>{p.name}</strong>
        {#if app.me === p.id}<span class="chip good">Das bin ich</span>{/if}
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .lead { margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pl {
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 6px 14px;
    border-radius: 18px; background: var(--surface); border: 1px solid var(--line); min-height: 150px;
  }
  .pl.sel { border-color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--surface)); }
  strong { font-size: 17px; }
</style>
