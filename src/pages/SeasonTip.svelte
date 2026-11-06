<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { router, href } from '../lib/router.svelte';
  import { seasonTipOpen, seasonDeadline } from '../domain/season';
  import { SEASON_POINTS } from '../domain/rules';
  import { formatDayTime } from '../lib/format';
  import { toasts, buzz } from '../lib/toast.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Picker from '../ui/Picker.svelte';
  import DriverTag from '../ui/DriverTag.svelte';

  let { onpickplayer }: { onpickplayer: () => void } = $props();

  const open = $derived(seasonTipOpen(app.season, app.now));
  const existing = $derived(app.me ? app.snap.seasonTips[app.me] : undefined);
  let wdc = $state<string | null>(null);
  let wcc = $state<string | null>(null);
  $effect.pre(() => {
    wdc = existing?.wdc ?? null;
    wcc = existing?.wcc ?? null;
  });

  let which = $state<'wdc' | 'wcc' | null>(null);
  let sheet = $state(false);
  let saving = $state(false);

  async function save() {
    if (!app.repo || !app.me || !wdc || !wcc) return;
    saving = true;
    try {
      app.snap.seasonTips[app.me] = await app.repo.saveSeasonTip(app.me, { wdc, wcc });
      buzz([10, 40, 20]);
      toasts.show('Saison-Tipp gespeichert', 'good');
      router.go('tabelle');
    } catch {
      toasts.show('Speichern hat nicht geklappt.', 'bad');
    } finally {
      saving = false;
    }
  }
</script>

<div class="page stack">
  <h1 class="title">Saison-Tipp</h1>
  {#if !app.me}
    <button class="btn primary" onclick={onpickplayer}>Erst Spieler wählen</button>
  {:else if !open}
    <div class="card empty">
      <div class="big">🔒</div>
      <p>Saison-Tipps waren bis {formatDayTime(seasonDeadline(app.season)!)} möglich.</p>
      {#if existing}
        <div class="locked"><DriverTag id={existing.wdc} full /> · <DriverTag id={existing.wcc} kind="team" /></div>
      {/if}
      <a class="btn" href={href('tabelle')} style="margin-top: 12px">Zur Tabelle</a>
    </div>
  {:else}
    <p class="muted">Einmal pro Saison, Abgabe bis {formatDayTime(seasonDeadline(app.season)!)}.</p>
    <div class="card flush list">
      <button class="slot" onclick={() => { which = 'wdc'; sheet = true; }}>
        <span class="grow"><span class="small faint">Weltmeister · {SEASON_POINTS.wdc} Punkte</span><br />{#if wdc}<DriverTag id={wdc} full />{:else}<span class="ph">Wählen</span>{/if}</span>›
      </button>
      <button class="slot" onclick={() => { which = 'wcc'; sheet = true; }}>
        <span class="grow"><span class="small faint">Konstrukteurs-WM · {SEASON_POINTS.wcc} Punkte</span><br />{#if wcc}<DriverTag id={wcc} kind="team" />{:else}<span class="ph">Wählen</span>{/if}</span>›
      </button>
    </div>
    <button class="btn primary block" disabled={!wdc || !wcc || saving} onclick={save}>{saving ? 'Speichere …' : 'Saison-Tipp speichern'}</button>
  {/if}
</div>

<Sheet bind:open={sheet} title={which === 'wdc' ? 'Weltmeister' : 'Konstrukteurs-WM'}>
  {#if which}
    <Picker kind={which === 'wdc' ? 'driver' : 'team'} value={which === 'wdc' ? wdc : wcc}
      onpick={(id) => { if (which === 'wdc') wdc = id; else wcc = id; sheet = false; }} />
  {/if}
</Sheet>

<style>
  .title { font-size: 26px; font-weight: 900; margin: 4px 2px; }
  .slot { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; text-align: left; font-size: 17px; color: var(--text-3); }
  .slot .grow { color: var(--text); }
  .ph { color: var(--accent-2); font-weight: 700; }
  .locked { margin-top: 10px; display: flex; gap: 8px; justify-content: center; }
</style>
