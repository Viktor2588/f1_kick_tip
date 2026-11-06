<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { children, data } = $props();

  const nav = [
    { href: '/', label: 'Übersicht', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { href: '/rennen', label: 'Rennen', icon: 'M4 21V4M4 4h12l-2 4 2 4H4' },
    { href: '/regeln', label: 'Regeln', icon: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 9h6M9 13h6' },
  ];
  const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<header class="top">
  <div class="wrap bar">
    <a href="/" class="logo" aria-label="F1 Kick Tip – Übersicht"><span class="f1">F1</span>Kick Tip <span class="yr">{data.meta.year}</span></a>
    <nav class="links" aria-label="Hauptnavigation">
      {#each nav as item}
        <a href={item.href} class:on={active(item.href)} aria-current={active(item.href) ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} /></svg><span>{item.label}</span>
        </a>
      {/each}
    </nav>
    <div class="me">
      {#if data.me}
        <span class="who">{data.me.name}</span>
      {/if}
    </div>
  </div>
</header>

<main class="wrap page">
  {@render children()}
</main>

<footer class="wrap foot muted small">F1 Kick Tip {data.meta.year} · {data.meta.players.map((p: { name: string }) => p.name).join(', ')}</footer>

<style>
  /* The blur sits on a pseudo element: a backdrop-filter on .top itself would trap the fixed phone tab bar inside the header. */
  .top { position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--line); }
  .top::before {
    content: ''; position: absolute; inset: 0; z-index: -1;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: saturate(160%) blur(14px);
    -webkit-backdrop-filter: saturate(160%) blur(14px);
  }
  .bar { display: flex; align-items: center; gap: 16px; min-height: 56px; }
  .logo { font-family: var(--font-display); font-weight: 900; font-size: 1.15rem; display: inline-flex; align-items: baseline; gap: 6px; margin-right: auto; white-space: nowrap; }
  .f1 { background: var(--accent); color: var(--on-accent); border-radius: 5px; padding: 0 5px; font-style: italic; }
  .yr { color: var(--text-3); font-weight: 700; }
  .me { display: flex; align-items: center; gap: 8px; }
  .who { font-weight: 600; font-size: 0.9rem; }

  .links {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: flex; justify-content: space-around;
    height: calc(var(--nav-h) + var(--safe-b)); padding-bottom: var(--safe-b);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: saturate(160%) blur(14px);
    -webkit-backdrop-filter: saturate(160%) blur(14px);
    border-top: 1px solid var(--line);
  }
  .links a { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 0.7rem; font-weight: 600; color: var(--text-3); }
  .links a.on { color: var(--accent-text); }
  .links svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .page { padding-top: 20px; padding-bottom: calc(var(--nav-h) + var(--safe-b) + 28px); }
  .foot { text-align: center; padding-bottom: calc(var(--nav-h) + var(--safe-b) + 16px); margin-top: -12px; }

  @media (min-width: 768px) {
    .logo { margin-right: 8px; }
    .links { position: static; height: auto; padding: 0; background: none; border: 0; backdrop-filter: none; -webkit-backdrop-filter: none; justify-content: flex-start; gap: 4px; }
    .links a { flex: none; flex-direction: row; gap: 8px; font-size: 0.9rem; padding: 7px 14px; border-radius: 999px; color: var(--text-2); }
    .links a:hover { background: var(--surface-2); }
    .links a.on { background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 1px var(--line-strong); }
    .links svg { width: 18px; height: 18px; }
    .me { margin-left: auto; }
    .page { padding-top: 28px; padding-bottom: 48px; }
    .foot { padding-bottom: 32px; margin-top: 0; }
  }
</style>
