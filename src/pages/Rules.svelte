<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href } from '../lib/router.svelte';
  import { RACE_POINTS, SPRINT_POINTS, SEASON_POINTS, DNF_FROM_ROUND, RACE_MAX_BASE, RACE_MAX_DNF, SPRINT_MAX, TIEBREAKERS } from '../domain/rules';
  import { deadlinesIcs, download } from '../lib/ics';
  import { flag } from '../lib/format';
  import { resetDemo as clearDemo } from '../data/demo-key';
  import { clock } from '../lib/clock';

  const race = [
    ['Rennsieger (= P1)', RACE_POINTS.p1],
    ['Platz 2 exakt', RACE_POINTS.p2],
    ['Platz 3 exakt', RACE_POINTS.p3],
    ['Podium-Bonus: Fahrer auf dem Podium, aber andere Position', `${RACE_POINTS.podiumBonus} je`],
    ['Pole Position', RACE_POINTS.pole],
    ['Schnellste Runde', RACE_POINTS.fastestLap],
    ['Bester Konstrukteur (meiste WM-Punkte im Rennen)', RACE_POINTS.bestConstructor],
    ['Perfekte Runde: alles oben richtig', `+${RACE_POINTS.perfect}`],
  ] as const;
  const extra = [
    ['DNF: getippter Fahrer startet, kommt aber nicht ins Ziel', RACE_POINTS.dnf],
    ['DNS: getippter Fahrer startet gar nicht erst', RACE_POINTS.dns],
  ] as const;
  const sprint = [
    ['Sprintsieger', SPRINT_POINTS.p1],
    ['Sprint Platz 2 exakt', SPRINT_POINTS.p2],
    ['Sprint Platz 3 exakt', SPRINT_POINTS.p3],
    ['Podium-Bonus', `${SPRINT_POINTS.podiumBonus} je`],
    ['Perfekter Sprint', `+${SPRINT_POINTS.perfect}`],
  ] as const;

  const sprints = app.season.races.filter((r) => r.sprint);
  const dnfRaces = app.season.races.filter((r) => r.round >= DNF_FROM_ROUND).length;
  const maxSeason = RACE_MAX_BASE * app.season.races.length + RACE_MAX_DNF * dnfRaces + SPRINT_MAX * sprints.length + SEASON_POINTS.wdc + SEASON_POINTS.wcc;

  function exportCal() {
    download('f1-kick-tip-deadlines.ics', deadlinesIcs(app.season, location.href.split('#')[0], Date.now()));
  }
  function resetDemo() {
    clearDemo();
    location.reload();
  }
</script>

<div class="page stack">
  <h1 class="title">Regeln</h1>

  <div class="card how">
    <strong>So läuft's</strong>
    <ol>
      <li>Vor jedem Rennen tippst du Podium, Pole, schnellste Runde und bestes Team.</li>
      <li>Tippschluss ist der Start. Bis dahin kannst du ändern, so oft du willst.</li>
      <li>Ab dem Start werden alle Tipps aufgedeckt.</li>
      <li>Montags früh kommt das Ergebnis rein, dann gibt's Punkte.</li>
    </ol>
  </div>

  <button class="btn block" onclick={exportCal}>📅 Alle Deadlines in den Kalender</button>

  <div class="section-title">Hauptrennen <span class="faint small">max. {RACE_MAX_BASE} (+{RACE_MAX_DNF})</span></div>
  <div class="card flush list">
    {#each race as [l, p]}<div class="r"><span class="grow">{l}</span><span class="pts hit">{p}</span></div>{/each}
  </div>
  <div class="card flush list">
    <div class="r sub tiny faint">Freiwillig, ab Runde {DNF_FROM_ROUND}, zählt nicht zur perfekten Runde</div>
    {#each extra as [l, p]}<div class="r"><span class="grow">{l}</span><span class="pts hit">{p}</span></div>{/each}
  </div>

  <div class="section-title">Sprint <span class="faint small">max. {SPRINT_MAX}</span></div>
  <div class="card flush list">
    {#each sprint as [l, p]}<div class="r"><span class="grow">{l}</span><span class="pts hit">{p}</span></div>{/each}
  </div>
  <div class="sprints">
    {#each sprints as r}<a class="chip" href={href(`rennen/${r.round}`)}>{flag(r.countryCode)} R{r.round} {r.country}</a>{/each}
  </div>

  <div class="section-title">Saison-Tipp</div>
  <div class="card flush list">
    <div class="r"><span class="grow">Weltmeister (Fahrer)</span><span class="pts hit">{SEASON_POINTS.wdc}</span></div>
    <div class="r"><span class="grow">Konstrukteurs-Weltmeister</span><span class="pts hit">{SEASON_POINTS.wcc}</span></div>
    <div class="r sub small faint">Abgabe vor Runde 1, Auflösung nach dem Finale.</div>
  </div>

  <div class="section-title">Gut zu wissen</div>
  <div class="card stack small muted">
    <p><strong>Zu spät:</strong> Ein Tipp nach dem Start zählt 0 Punkte.</p>
    <p><strong>Gleichstand:</strong> {TIEBREAKERS.join(' → ')}.</p>
    <p><strong>Maximal möglich:</strong> {maxSeason} Punkte in der Saison.</p>
  </div>

  <div class="foot small faint">
    <a href={href('admin')}>Ergebnisse eintragen</a>
    {#if app.mode === 'demo'}
      · <button class="link" onclick={resetDemo}>Demo zurücksetzen</button>
      {#if clock.simulated}· Simulierte Zeit{/if}
    {/if}
  </div>
</div>

<style>
  .title { font-size: 26px; font-weight: 900; margin: 4px 2px; }
  .how ol { margin: 8px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; color: var(--text-2); }
  .r { display: flex; align-items: center; gap: 12px; padding: 11px 14px; }
  .r.sub { background: var(--bg-2); }
  .sprints { display: flex; flex-wrap: wrap; gap: 6px; }
  .foot { text-align: center; padding: 16px 0; }
  .foot a, .link { text-decoration: underline; color: var(--text-2); }
</style>
