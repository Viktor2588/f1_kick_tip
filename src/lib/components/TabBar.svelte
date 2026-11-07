<script lang="ts">
  import { page } from '$app/state';
  let { tipHref }: { tipHref: string | null } = $props();

  const path = $derived(page.url.pathname);
  const is = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
</script>

<nav class="bar" aria-label="Hauptnavigation">
  <a href="/" class:on={is('/')} aria-current={is('/') ? 'page' : undefined}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
    <span>Start</span>
  </a>
  <a href="/rennen" class:on={is('/rennen') && !(tipHref && path === tipHref.split('#')[0])} aria-current={is('/rennen') ? 'page' : undefined}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
    <span>Kalender</span>
  </a>
  {#if tipHref}
    <a href={tipHref} class="tip" aria-label="Jetzt tippen">
      <span class="fab">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
      </span>
      <span>Tippen</span>
    </a>
  {/if}
  <a href="/tabelle" class:on={is('/tabelle')} aria-current={is('/tabelle') ? 'page' : undefined}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21V11M16 21V7M12 21V3M4 21h16"/></svg>
    <span>Tabelle</span>
  </a>
  <a href="/mehr" class:on={is('/mehr') || is('/regeln') || is('/saison') || is('/admin') || is('/login')} aria-current={is('/mehr') ? 'page' : undefined}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
    <span>Mehr</span>
  </a>
</nav>

<style>
  .bar {
    position: fixed; inset: auto 0 0 0; z-index: 20;
    display: flex; justify-content: space-around; align-items: flex-end;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding: 0 6px env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
    backdrop-filter: saturate(1.6) blur(16px);
    -webkit-backdrop-filter: saturate(1.6) blur(16px);
    border-top: 1px solid var(--line);
  }
  a {
    flex: 1; max-width: 110px; height: var(--tabbar-h);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    color: var(--text-3); text-decoration: none; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em;
  }
  a.on { color: var(--text); }
  svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  a.on svg { stroke: var(--accent); }
  .tip { color: var(--text); }
  .fab {
    width: 52px; height: 52px; margin-top: -22px; border-radius: 50%;
    display: grid; place-items: center;
    background: var(--accent); color: #fff;
    box-shadow: 0 6px 18px rgb(225 6 0 / 0.45), 0 0 0 4px var(--bg);
  }
  .fab svg { stroke: #fff; }
  @media (min-width: 900px) {
    .bar { left: 50%; right: auto; transform: translateX(-50%); bottom: 16px; width: 560px; border-radius: 22px; border: 1px solid var(--line); padding-bottom: 0; height: var(--tabbar-h); }
  }
</style>
