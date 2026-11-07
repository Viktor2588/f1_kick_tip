<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import { playerById, season } from '$lib/domain/season';
  import { LATEST_UPDATE } from '$lib/update';

  let { data } = $props();
  const me = $derived(playerById(data.viewer));
</script>

<svelte:head><title>Mehr · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Mehr</h1>

  <section class="card me">
    {#if me}
      <Avatar id={me.id} size={48} />
      <div class="who"><b>{me.name}</b><span class="small faint">angemeldet{data.isAdmin ? ' · Admin' : ''}</span></div>
      <form method="POST" action="?/logout"><button class="btn btn-sm">Abmelden</button></form>
    {:else}
      <div class="who"><b>Nicht angemeldet</b><span class="small faint">Zum Ansehen brauchst du kein Login.</span></div>
      <a href="/login" class="btn btn-sm btn-primary">Anmelden</a>
    {/if}
  </section>

  <nav class="links">
    <a href="/saison"><span>🏆</span><b>Saison-Tipps</b><small>Weltmeister & Konstrukteurs-WM</small></a>
    <a href="/regeln"><span>📖</span><b>Regeln & Punkte</b><small>So wird gezählt</small></a>
    {#if data.isAdmin}<a href="/admin"><span>🛠</span><b>Ergebnisse eintragen</b><small>Admin</small></a>{/if}
  </nav>

  <section class="section">
    <h2 class="section-title">{LATEST_UPDATE.title}</h2>
    <ul class="card upd small">{#each LATEST_UPDATE.items as it}<li>{it}</li>{/each}</ul>
  </section>

  <p class="small faint foot">F1 Kick Tip {season.season} · {season.players.map((p) => p.name).join(', ')}</p>
</main>

<style>
  .me { display: flex; align-items: center; gap: 12px; }
  .who { flex: 1; display: flex; flex-direction: column; }
  .links { display: grid; gap: 8px; margin-top: 16px; }
  .links a {
    display: grid; grid-template-columns: 36px 1fr; grid-template-areas: 'i t' 'i s'; align-items: center;
    padding: 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); text-decoration: none;
  }
  .links span { grid-area: i; font-size: 1.4rem; }
  .links b { grid-area: t; }
  .links small { grid-area: s; color: var(--text-3); }
  .upd { padding-left: 32px; display: grid; gap: 6px; color: var(--text-2); margin: 0; }
  .foot { text-align: center; margin-top: 28px; }
</style>
