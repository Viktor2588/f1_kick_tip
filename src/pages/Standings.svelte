<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href } from '../lib/router.svelte';
  import { seasonTipOpen } from '../domain/season';
  import { SEASON_POINTS, TIEBREAKERS } from '../domain/rules';
  import type { CategoryKey } from '../domain/standings';
  import { flag } from '../lib/format';
  import Avatar from '../ui/Avatar.svelte';
  import DriverTag from '../ui/DriverTag.svelte';
  import LineChart from '../ui/LineChart.svelte';

  const st = $derived(app.standings);
  const leader = $derived(st[0]?.total ?? 0);
  const medal = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];
  const seasonOpen = $derived(seasonTipOpen(app.season, app.now));

  const CATS: { key: CategoryKey; label: string }[] = [
    { key: 'p1', label: 'Sieger' },
    { key: 'p2', label: 'P2' },
    { key: 'p3', label: 'P3' },
    { key: 'pole', label: 'Pole' },
    { key: 'fastestLap', label: 'Schn. Runde' },
    { key: 'bestConstructor', label: 'Team' },
    { key: 'dnf', label: 'DNF' },
    { key: 'dns', label: 'DNS' },
    { key: 'sprintP1', label: 'Sprintsieger' },
  ];
  const pct = (c: { hits: number; attempts: number }) => (c.attempts ? Math.round((c.hits / c.attempts) * 100) : null);
  const bestIn = (key: CategoryKey) => Math.max(...st.map((s) => pct(s.categories[key]) ?? -1));
  const visibleCats = $derived(CATS.filter((c) => st.some((s) => s.categories[c.key].attempts > 0)));

  // Weekend wins: who scored most per round (ties count for everyone tied).
  const weekendWins = $derived.by(() => {
    const wins: Record<string, number> = {};
    const n = st[0]?.perRound.length ?? 0;
    for (let i = 0; i < n; i++) {
      const top = Math.max(...st.map((s) => s.perRound[i].points));
      if (top <= 0) continue;
      for (const s of st) if (s.perRound[i].points === top) wins[s.playerId] = (wins[s.playerId] ?? 0) + 1;
    }
    return wins;
  });
</script>

<div class="page stack">
  <h1 class="title">Tabelle</h1>

  <div class="podium">
    {#each st as s (s.playerId)}
      {@const p = app.playerById(s.playerId)}
      <div class="pcard rise" class:me={s.playerId === app.me} style="--c: {p?.color}; --m: {medal[s.rank - 1] ?? 'var(--surface-3)'}">
        <span class="rank num">{s.rank}</span>
        <Avatar id={s.playerId} size={46} />
        <strong class="nm">{p?.name}</strong>
        <span class="total num">{s.total}</span>
        <span class="faint small num">{s.total === leader ? 'Führung' : `−${leader - s.total}`}</span>
      </div>
    {/each}
  </div>

  <div class="section-title">Punkteverlauf</div>
  <div class="card"><LineChart standings={st} /></div>

  <div class="section-title">Zahlen</div>
  <div class="card flush">
    <table class="stats">
      <thead>
        <tr><th></th>{#each st as s (s.playerId)}<th><Avatar id={s.playerId} size={26} ring={s.playerId === app.me} /></th>{/each}</tr>
      </thead>
      <tbody>
        <tr><th class="faint">Rennen</th>{#each st as s}<td class="num">{s.racePoints}</td>{/each}</tr>
        <tr><th class="faint">Sprints</th>{#each st as s}<td class="num">{s.sprintPoints}</td>{/each}</tr>
        <tr><th class="faint">Saison-Tipp</th>{#each st as s}<td class="num">{app.season.final ? s.seasonPoints : '?'}</td>{/each}</tr>
        <tr><th class="faint">Quote</th>{#each st as s}<td class="num">{s.accuracy}%</td>{/each}</tr>
        <tr><th class="faint">Wochenend-Siege</th>{#each st as s}<td class="num">{weekendWins[s.playerId] ?? 0}</td>{/each}</tr>
        <tr><th class="faint">Perfekte Runden</th>{#each st as s}<td class="num">{s.perfectRounds}</td>{/each}</tr>
        <tr>
          <th class="faint">Bestes Rennen</th>
          {#each st as s}
            <td class="num">
              {#if s.best && s.best.points > 0}
                {@const r = app.race(s.best.round)}
                <a href={href(`rennen/${s.best.round}`)}>{s.best.points} <span class="faint small">{r ? flag(r.countryCode) : ''}</span></a>
              {:else}–{/if}
            </td>
          {/each}
        </tr>
        <tr><th class="faint">Ohne Tipp</th>{#each st as s}<td class="num">{s.missedTips}</td>{/each}</tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">Trefferquote</div>
  <div class="card flush">
    <table class="stats">
      <thead>
        <tr><th></th>{#each st as s (s.playerId)}<th><Avatar id={s.playerId} size={26} ring={s.playerId === app.me} /></th>{/each}</tr>
      </thead>
      <tbody>
        {#each visibleCats as c (c.key)}
          {@const top = bestIn(c.key)}
          <tr>
            <th class="faint">{c.label}</th>
            {#each st as s}
              {@const v = pct(s.categories[c.key])}
              <td>
                {#if v == null}<span class="faint">–</span>{:else}
                  <div class="bar" class:top={v === top && v > 0}>
                    <span style="width: {Math.max(4, v)}%"></span>
                    <em class="num">{v}%</em>
                  </div>
                  <span class="faint tiny-n num">{s.categories[c.key].hits}/{s.categories[c.key].attempts}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="section-title">Saison-Tipps <span class="faint small">WM {SEASON_POINTS.wdc} · Team-WM {SEASON_POINTS.wcc}</span></div>
  <div class="card flush list">
    {#each st as s (s.playerId)}
      {@const t = app.snap.seasonTips[s.playerId]}
      <div class="season-row">
        <Avatar id={s.playerId} size={30} />
        {#if !t}
          <span class="faint small grow">Kein Saison-Tipp</span>
        {:else if seasonOpen && s.playerId !== app.me}
          <span class="faint small grow">Abgegeben · verdeckt bis Runde 1</span>
        {:else}
          <span class="grow st">
            <DriverTag id={t.wdc} full state={app.season.final?.wdc ? (app.season.final.wdc === t.wdc ? 'hit' : 'miss') : null} />
            <DriverTag id={t.wcc} kind="team" state={app.season.final?.wcc ? (app.season.final.wcc === t.wcc ? 'hit' : 'miss') : null} />
          </span>
        {/if}
      </div>
    {/each}
  </div>
  {#if seasonOpen}<a class="btn block" href={href('saisontipp')}>Saison-Tipp abgeben</a>{/if}
  {#if !app.season.final}<p class="faint small pad">Wird nach dem letzten Rennen aufgelöst.</p>{/if}

  <p class="faint small pad">Gleichstand? Es entscheidet: {TIEBREAKERS.join(' → ')}.</p>
</div>

<style>
  .title { font-size: 26px; font-weight: 900; margin: 4px 2px; }
  .podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .pcard {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 16px 6px 12px;
    border-radius: 18px; background: var(--surface); border: 1px solid var(--line);
  }
  .pcard.me { border-color: color-mix(in srgb, var(--c) 60%, var(--line)); background: color-mix(in srgb, var(--c) 9%, var(--surface)); }
  .rank { position: absolute; top: 8px; left: 8px; width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 13px; background: var(--m); color: #111; }
  .nm { margin-top: 6px; font-size: 16px; }
  .total { font-size: 30px; font-weight: 900; line-height: 1; }
  .stats { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 15px; }
  .stats th, .stats td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; font-weight: 600; }
  .stats tbody tr:last-child > * { border-bottom: 0; }
  .stats tbody th { font-size: 13px; width: 34%; font-weight: 600; }
  .stats thead th { padding-top: 12px; }
  .bar { position: relative; height: 20px; border-radius: 6px; background: var(--surface-2); overflow: hidden; }
  .bar span { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--text-3) 35%, transparent); border-radius: 6px; }
  .bar.top span { background: color-mix(in srgb, var(--good) 45%, transparent); }
  .bar em { position: relative; font-style: normal; font-size: 12px; font-weight: 800; padding-left: 6px; line-height: 20px; }
  .tiny-n { font-size: 10px; }
  .season-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .st { display: flex; flex-direction: column; gap: 2px; }
  .pad { padding: 0 4px; }
</style>
