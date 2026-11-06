<script lang="ts">
  import { POINTS } from '$lib/scoring';
  import { page } from '$app/state';

  const r = POINTS.race;
  const s = POINTS.sprint;
  const race = [
    ['Rennsieger (= P1)', 'Richtiger Rennsieger', r.winner],
    ['Podium P2', 'Richtiger Fahrer auf P2', r.podiumP2],
    ['Podium P3', 'Richtiger Fahrer auf P3', r.podiumP3],
    ['Podium-Bonus', 'Fahrer auf dem Podium, aber andere Position (P1/P2/P3)', `${r.podiumBonus} je`],
    ['Pole Position', 'Exakt richtig getippt', r.pole],
    ['Schnellste Runde', 'Exakt richtig getippt', r.fastestLap],
    ['Bester Konstrukteur', 'Team mit den meisten WM-Punkten im Rennen', r.bestConstructor],
    ['Perfekte Runde', 'Alle Kategorien oben richtig (ohne DNF/DNS)', `${r.perfectRound} Bonus`],
    ['DNF', 'Getippter Fahrer startet, kommt aber nicht ins Ziel (ab Runde 16)', r.dnf],
    ['DNS', 'Getippter Fahrer startet gar nicht (ab Runde 16)', r.dns],
  ] as const;
  const sprint = [
    ['Sprint-Sieger (= P1)', 'Richtiger Sprint-Sieger', s.winner],
    ['Sprint P2', 'Richtiger Fahrer auf P2', s.p2],
    ['Sprint P3', 'Richtiger Fahrer auf P3', s.p3],
    ['Sprint Podium-Bonus', 'Fahrer auf dem Podium, andere Position', `${s.podiumBonus} je`],
    ['Perfekter Sprint', 'Alle 3 Positionen exakt', `${s.perfect} Bonus`],
  ] as const;
</script>

<svelte:head><title>Regeln – F1 Kick Tip</title></svelte:head>

<h1>Spielregeln</h1>
<p class="muted lead">So werden die Punkte vergeben.</p>

<div class="grid">
  <section class="card">
    <h2>Hauptrennen <span class="muted small">max. {POINTS.raceMax} + {POINTS.raceMaxDnfDns} (DNF/DNS)</span></h2>
    <ul class="rules">
      {#each race as [name, cond, pts]}<li><div><b>{name}</b><span>{cond}</span></div><strong>{pts}</strong></li>{/each}
    </ul>
    <p class="muted small">Der Rennsieger ist automatisch P1. DNF und DNS sind freiwillig, je ein Fahrer, nicht derselbe Fahrer für beides.</p>
  </section>

  <section class="card">
    <h2>Sprint <span class="muted small">max. {POINTS.sprintMax}</span></h2>
    <ul class="rules">
      {#each sprint as [name, cond, pts]}<li><div><b>{name}</b><span>{cond}</span></div><strong>{pts}</strong></li>{/each}
    </ul>
    <p class="muted small">Sprint-Wochenenden {page.data.meta.year}: siehe <a href="/rennen" class="link">Rennkalender</a>.</p>
  </section>

  <section class="card">
    <h2>Saison-Tipps</h2>
    <ul class="rules">
      <li><div><b>Weltmeister (WDC)</b><span>Richtiger Fahrer</span></div><strong>{POINTS.season.wdc}</strong></li>
      <li><div><b>Konstrukteurs-WM (WCC)</b><span>Richtiges Team</span></div><strong>{POINTS.season.wcc}</strong></li>
    </ul>
    <p class="muted small">Abgabe vor dem Start von Runde 1, Auflösung am Saisonende.</p>
  </section>

  <section class="card">
    <h2>Deadlines</h2>
    <ul class="plain">
      <li><b>Renntipps</b> bis zum Rennstart</li>
      <li><b>Sprint-Tipps</b> bis zum Sprint-Start</li>
      <li><b>Saison-Tipps</b> bis zum Start von Runde 1</li>
      <li>Verspätete Tipps zählen <b>0 Punkte</b>.</li>
    </ul>
  </section>

  <section class="card">
    <h2>Gleichstand</h2>
    <ol class="plain">
      <li>Mehr richtige Sieger-Tipps</li>
      <li>Mehr perfekte Runden</li>
      <li>Mehr richtige Pole-Tipps</li>
    </ol>
  </section>
</div>

<style>
  .lead { margin: 4px 0 18px; }
  .grid { display: grid; gap: 12px; }
  h2 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .rules { list-style: none; }
  .rules li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
  .rules li:first-child { border-top: 0; }
  .rules div { display: grid; }
  .rules span { color: var(--text-2); font-size: 0.88rem; }
  .rules strong { color: var(--accent-text); white-space: nowrap; }
  .plain { padding-left: 1.2rem; line-height: 1.9; }
  ul.plain { list-style: disc; }
  p.small { margin-top: 8px; }
  .link { color: var(--accent-text); font-weight: 600; }
  @media (min-width: 768px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
