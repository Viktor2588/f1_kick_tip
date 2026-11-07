<script lang="ts">
  import Avatar from './Avatar.svelte';
  import UpdateNotice from './UpdateNotice.svelte';
  import { season } from '$lib/domain/season';

  let { viewer }: { viewer: string | null } = $props();
</script>

<header class="top">
  <a href="/" class="logo" aria-label="F1 Kick Tip Startseite">
    <span class="f1">F1</span><span class="kt">Kick Tip</span><span class="yr">{season.season}</span>
  </a>
  <div class="right">
    <UpdateNotice />
    {#if viewer}
      <a href="/mehr" aria-label="Profil"><Avatar id={viewer} size={36} /></a>
    {:else}
      <a href="/login" class="btn btn-sm btn-primary">Anmelden</a>
    {/if}
  </div>
</header>

<style>
  .top { display: flex; align-items: center; justify-content: space-between; min-height: 48px; }
  .logo { display: flex; align-items: baseline; gap: 6px; text-decoration: none; }
  .f1 {
    background: var(--accent); color: #fff; font-weight: 900; font-style: italic;
    padding: 0 7px; border-radius: 6px; font-size: 1.05rem; transform: skewX(-8deg);
  }
  .kt { font-weight: 900; font-size: 1.25rem; letter-spacing: -0.01em; }
  .yr { color: var(--text-3); font-weight: 700; font-size: 0.85rem; }
  .right { display: flex; align-items: center; gap: 10px; }
  .right a { display: flex; text-decoration: none; }
</style>
