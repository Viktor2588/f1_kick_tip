<script lang="ts">
  import { season, flag } from '$lib/domain/season';
  import { POINTS, RACE_BASE_MAX, RACE_DNF_DNS_MAX, SPRINT_MAX } from '$lib/domain/scoring';

  const P = POINTS.race;
  const S = POINTS.sprint;
  const races = season.races.length;
  const dnfRaces = season.races.filter((r) => r.round >= season.rules.dnfFromRound).length;
  const sprints = season.races.filter((r) => r.sprint);
  const seasonMax = POINTS.season.wdc + POINTS.season.wcc;
  const total = RACE_BASE_MAX * races + RACE_DNF_DNS_MAX * dnfRaces + SPRINT_MAX * sprints.length + seasonMax;
</script>

<svelte:head><title>Regeln · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Regeln & Punkte</h1>
  <p class="page-sub">Tippen bis zum Start, danach werden alle Tipps aufgedeckt.</p>

  <section class="section">
    <h2 class="section-title">Rennen · max. {RACE_BASE_MAX} (+{RACE_DNF_DNS_MAX})</h2>
    <dl class="card rules">
      <div><dt>Rennsieger (= P1)</dt><dd>{P.winner}</dd></div>
      <div><dt>Platz 2 exakt</dt><dd>{P.p2}</dd></div>
      <div><dt>Platz 3 exakt</dt><dd>{P.p3}</dd></div>
      <div><dt>Podium-Bonus <small>Fahrer auf dem Podium, aber auf anderer Position (je Fahrer)</small></dt><dd>{P.podiumBonus}</dd></div>
      <div><dt>Pole Position</dt><dd>{P.pole}</dd></div>
      <div><dt>Schnellste Runde</dt><dd>{P.fastestLap}</dd></div>
      <div><dt>Bester Konstrukteur <small>Team mit den meisten Punkten im Rennen; bei Gleichstand zählt die beste Einzelplatzierung</small></dt><dd>{P.bestConstructor}</dd></div>
      <div class="gold"><dt>Perfekte Runde <small>alles oben richtig (ohne DNF/DNS)</small></dt><dd>+{P.perfect}</dd></div>
      <div><dt>Ausfall (DNF) <small>dein Fahrer startet, kommt aber nicht ins Ziel · ab Runde {season.rules.dnfFromRound}</small></dt><dd>{P.dnf}</dd></div>
      <div><dt>Nicht gestartet (DNS) <small>dein Fahrer startet gar nicht · ab Runde {season.rules.dnfFromRound}</small></dt><dd>{P.dns}</dd></div>
    </dl>
    <p class="small muted">DNF und DNS sind freiwillig, je ein Fahrer, und nicht derselbe für beides.</p>
  </section>

  <section class="section">
    <h2 class="section-title">Sprint · max. {SPRINT_MAX}</h2>
    <dl class="card rules">
      <div><dt>Sprint-Sieger</dt><dd>{S.winner}</dd></div>
      <div><dt>Platz 2 exakt</dt><dd>{S.p2}</dd></div>
      <div><dt>Platz 3 exakt</dt><dd>{S.p3}</dd></div>
      <div><dt>Podium-Bonus <small>je Fahrer</small></dt><dd>{S.podiumBonus}</dd></div>
      <div class="gold"><dt>Perfekter Sprint</dt><dd>+{S.perfect}</dd></div>
    </dl>
    <p class="small muted">Sprint-Wochenenden: {#each sprints as r, i}{i ? ', ' : ''}{flag(r.countryCode)} R{r.round} {r.country}{/each}</p>
  </section>

  <section class="section">
    <h2 class="section-title">Saison · max. {seasonMax}</h2>
    <dl class="card rules">
      <div><dt>Fahrer-Weltmeister</dt><dd>{POINTS.season.wdc}</dd></div>
      <div><dt>Konstrukteurs-Weltmeister</dt><dd>{POINTS.season.wcc}</dd></div>
    </dl>
    <p class="small muted">Abgabe bis zum Start von Runde 1, Auflösung am Saisonende.</p>
  </section>

  <section class="section">
    <h2 class="section-title">Deadlines & Gleichstand</h2>
    <div class="card prose">
      <p><b>Renntipp</b> bis zum Rennstart, <b>Sprint-Tipp</b> bis zum Sprint-Start. Danach nimmt die App keine Tipps mehr an. Bis dahin kannst du deinen Tipp beliebig oft ändern.</p>
      <p>Die Tipps der anderen siehst du erst ab dem Start.</p>
      <p>Bei Punktgleichheit gewinnt, wer mehr <b>Sieger</b> richtig hatte, dann mehr <b>perfekte Runden</b>, dann mehr <b>Poles</b>.</p>
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">Maximal möglich {season.season}</h2>
    <dl class="card rules">
      <div><dt>Rennen <small>{RACE_BASE_MAX} × {races}</small></dt><dd>{RACE_BASE_MAX * races}</dd></div>
      <div><dt>DNF/DNS <small>{RACE_DNF_DNS_MAX} × {dnfRaces}</small></dt><dd>{RACE_DNF_DNS_MAX * dnfRaces}</dd></div>
      <div><dt>Sprint <small>{SPRINT_MAX} × {sprints.length}</small></dt><dd>{SPRINT_MAX * sprints.length}</dd></div>
      <div><dt>Saison</dt><dd>{seasonMax}</dd></div>
      <div class="sum"><dt>Gesamt</dt><dd>{total}</dd></div>
    </dl>
  </section>
</main>

<style>
  .rules { margin: 0; padding: 4px 16px; }
  .rules div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; }
  .rules div + div { border-top: 1px solid var(--line); }
  dt { font-weight: 600; display: flex; flex-direction: column; }
  dt small { font-weight: 400; color: var(--text-3); }
  dd { margin: 0; font-weight: 900; font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .gold dd, .gold dt { color: var(--gold); }
  .sum dd { color: var(--accent); font-size: 1.4rem; }
  .prose p { margin: 0 0 8px; color: var(--text-2); }
  .prose p:last-child { margin: 0; }
  p.small { margin: 8px 4px 0; }
</style>
