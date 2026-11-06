<script lang="ts">
  import { app } from './lib/store.svelte';
  import { router } from './lib/router.svelte';
  import { toasts } from './lib/toast.svelte';
  import { upcomingDeadlines } from './domain/season';
  import { fly } from 'svelte/transition';
  import TopBar from './ui/TopBar.svelte';
  import TabBar from './ui/TabBar.svelte';
  import PlayerSwitch from './ui/PlayerSwitch.svelte';
  import Home from './pages/Home.svelte';
  import Races from './pages/Races.svelte';
  import RaceDetail from './pages/RaceDetail.svelte';
  import TipEditor from './pages/TipEditor.svelte';
  import SeasonTip from './pages/SeasonTip.svelte';
  import Standings from './pages/Standings.svelte';
  import Rules from './pages/Rules.svelte';
  import Admin from './pages/Admin.svelte';

  let switchOpen = $state(false);
  app.init();

  // First visit: ask who's playing.
  $effect(() => {
    if (app.status === 'ready' && !app.me) switchOpen = true;
  });

  // "Tippen" tab: jump to whatever deadline comes next.
  $effect(() => {
    if (router.route.name !== 'tipNext' || app.status !== 'ready') return;
    const d = upcomingDeadlines(app.season, app.now)[0];
    if (!d) router.go('rennen', true);
    else if (d.kind === 'season') router.go('saisontipp', true);
    else router.go(`tipp/${d.race!.round}${d.kind === 'sprint' ? '/sprint' : ''}`, true);
  });

  const route = $derived(router.route);
  const key = $derived(JSON.stringify(route));
</script>

<TopBar onswitch={() => (switchOpen = true)} />

<main>
  {#if app.status === 'loading'}
    <div class="page stack" aria-busy="true">
      <div class="sk hero"></div>
      <div class="sk"></div>
      <div class="sk tall"></div>
    </div>
  {:else if app.status === 'error'}
    <div class="page">
      <div class="card empty">
        <div class="big">📡</div>
        <strong>Daten konnten nicht geladen werden.</strong>
        <p class="small">{app.error}</p>
        <button class="btn primary" style="margin-top: 14px" onclick={() => location.reload()}>Nochmal versuchen</button>
      </div>
    </div>
  {:else}
    {#key key}
      <div class="view">
        {#if route.name === 'home'}<Home />
        {:else if route.name === 'races'}<Races />
        {:else if route.name === 'race'}<RaceDetail round={route.round} />
        {:else if route.name === 'tip'}<TipEditor round={route.round} sprint={route.sprint} onpickplayer={() => (switchOpen = true)} />
        {:else if route.name === 'seasonTip'}<SeasonTip onpickplayer={() => (switchOpen = true)} />
        {:else if route.name === 'standings'}<Standings />
        {:else if route.name === 'rules'}<Rules />
        {:else if route.name === 'admin'}<Admin round={route.round} />
        {/if}
      </div>
    {/key}
  {/if}
</main>

<TabBar />
<PlayerSwitch bind:open={switchOpen} />

<div class="toasts" aria-live="polite">
  {#each toasts.list as t (t.id)}
    <div class="toast {t.kind}" transition:fly={{ y: -20, duration: 200 }}>{t.text}</div>
  {/each}
</div>

<style>
  .view { animation: rise 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .sk { height: 90px; border-radius: 18px; background: linear-gradient(90deg, var(--surface) 0%, var(--surface-2) 50%, var(--surface) 100%); background-size: 200% 100%; animation: shimmer 1.2s infinite linear; }
  .sk.hero { height: 260px; }
  .sk.tall { height: 180px; }
  @keyframes shimmer { to { background-position: -200% 0; } }
  .toasts { position: fixed; top: calc(12px + var(--safe-t)); left: 0; right: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; padding: 0 16px; }
  .toast { background: var(--surface-3); color: var(--text); border: 1px solid var(--line-strong); padding: 10px 16px; border-radius: 14px; font-weight: 700; box-shadow: var(--shadow); max-width: 480px; }
  .toast.good { background: var(--good); color: #04140b; border-color: transparent; }
  .toast.bad { background: var(--bad); color: #fff; border-color: transparent; }
</style>
