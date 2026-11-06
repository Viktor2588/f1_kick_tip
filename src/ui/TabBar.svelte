<script lang="ts">
  import { router, href } from '../lib/router.svelte';

  const r = $derived(router.route.name);
  const tabs = [
    { path: '', label: 'Start', match: ['home'], icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { path: 'rennen', label: 'Rennen', match: ['races', 'race'], icon: 'M4 21V4m0 0h13l-2 4 2 4H4' },
    { path: 'tipp', label: 'Tippen', match: ['tip', 'tipNext', 'seasonTip'], icon: '', primary: true },
    { path: 'tabelle', label: 'Tabelle', match: ['standings'], icon: 'M7 21V10m5 11V4m5 17v-7' },
    { path: 'regeln', label: 'Regeln', match: ['rules', 'admin'], icon: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 9h6M9 13h6' },
  ];
</script>

<nav class="tabbar" aria-label="Hauptnavigation">
  {#each tabs as t}
    {@const active = t.match.includes(r)}
    <a href={href(t.path)} class="tab" class:active class:primary={t.primary} aria-current={active ? 'page' : undefined}>
      {#if t.primary}
        <span class="fab" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        </span>
      {:else}
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
      {/if}
      <span class="lbl">{t.label}</span>
    </a>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
    display: grid; grid-template-columns: repeat(5, 1fr);
    height: calc(var(--tabbar-h) + var(--safe-b)); padding-bottom: var(--safe-b);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: saturate(1.6) blur(18px); -webkit-backdrop-filter: saturate(1.6) blur(18px);
    border-top: 1px solid var(--line);
  }
  .tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--text-3); font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
  .tab.active { color: var(--text); }
  .tab.active svg { color: var(--accent-2); }
  .primary { position: relative; }
  .fab {
    display: grid; place-items: center; width: 54px; height: 54px; border-radius: 18px; margin-top: -26px;
    background: linear-gradient(140deg, var(--accent-2), var(--accent)); color: #fff;
    box-shadow: 0 8px 22px rgb(225 6 0 / 0.45), 0 0 0 4px var(--bg);
    transition: transform 0.15s;
  }
  .primary:active .fab { transform: scale(0.94); }
  .primary .lbl { color: var(--text-2); }
  @media (min-width: 900px) {
    .tabbar { left: 50%; transform: translateX(-50%); bottom: 16px; width: 520px; border-radius: 22px; border: 1px solid var(--line); height: var(--tabbar-h); padding: 0; }
  }
</style>
