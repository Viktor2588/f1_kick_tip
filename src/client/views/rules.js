import { html } from '../lib/html.js';

const Row = ([what, when, points]) => html`<tr><th scope="row">${what}</th><td>${when}</td><td class="num">${points}</td></tr>`;

export function Rules() {
  return html`<div class="stack rules">
    <header class="page-head">
      <h1>Regeln</h1>
      <p class="muted">Vor jedem Rennen tippen, Punkte sammeln, am Ende gewinnt, wer am meisten hat.</p>
    </header>

    <section class="card">
      <h2>Hauptrennen <small class="muted">max. 21 Punkte, ab Runde 16 max. 29</small></h2>
      <table class="rules-table">
        <thead><tr><th>Tipp</th><th>Wann gibt's Punkte?</th><th class="num">Punkte</th></tr></thead>
        <tbody>
          ${[
            ['Sieger (= P1)', 'Richtiger Rennsieger', 3],
            ['P2', 'Richtiger Fahrer auf P2', 2],
            ['P3', 'Richtiger Fahrer auf P3', 2],
            ['Podium-Bonus', 'Getippter Podiumsfahrer steht auf dem Podium, aber auf einer anderen Position (P1, P2 oder P3)', '1 je'],
            ['Pole Position', 'Richtig getippt', 3],
            ['Schnellste Runde', 'Richtig getippt', 3],
            ['Bester Konstrukteur', 'Team mit den meisten WM-Punkten im Rennen (bei Gleichstand: beste Einzelplatzierung)', 3],
            ['Perfekte Runde', 'Sieger, P2, P3, Pole, schnellste Runde und Konstrukteur alle richtig', '+5'],
            ['DNF (ab Runde 16)', 'Dein Fahrer startet, kommt aber nicht ins Ziel', 3],
            ['DNS (ab Runde 16)', 'Dein Fahrer startet gar nicht erst', 5],
          ].map(Row)}
        </tbody>
      </table>
      <p class="muted small">DNF und DNS sind freiwillig, je ein Fahrer, und zählen nicht zur perfekten Runde. Ein Fahrer kann nicht für beides getippt werden.</p>
    </section>

    <section class="card">
      <h2>Sprint <small class="muted">max. 7 Punkte</small></h2>
      <table class="rules-table">
        <thead><tr><th>Tipp</th><th>Wann gibt's Punkte?</th><th class="num">Punkte</th></tr></thead>
        <tbody>
          ${[
            ['Sprint-Sieger', 'Richtiger Sieger', 3],
            ['Sprint P2', 'Richtiger Fahrer auf P2', 1],
            ['Sprint P3', 'Richtiger Fahrer auf P3', 1],
            ['Podium-Bonus', 'Auf dem Podium, aber andere Position', '1 je'],
            ['Perfekter Sprint', 'Alle drei Positionen exakt', '+2'],
          ].map(Row)}
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>Saison-Tipp <small class="muted">einmal, vor Runde 1</small></h2>
      <table class="rules-table">
        <tbody>${[['Weltmeister (WDC)', 'Richtiger Fahrer', 20], ['Konstrukteurs-WM (WCC)', 'Richtiges Team', 15]].map(Row)}</tbody>
      </table>
      <p class="muted small">Wird am Saisonende aufgelöst.</p>
    </section>

    <section class="card">
      <h2>Tippschluss</h2>
      <ul class="plain">
        <li><b>Renntipp:</b> bis zum Rennstart.</li>
        <li><b>Sprint-Tipp:</b> bis zum Sprint-Start.</li>
        <li><b>Saison-Tipp:</b> bis zum Start von Runde 1.</li>
        <li>Zu spät abgegebene Tipps bringen 0 Punkte.</li>
      </ul>
      <h2>Gleichstand</h2>
      <ol class="plain">
        <li>Mehr richtige Sieger-Tipps</li>
        <li>Mehr perfekte Runden</li>
        <li>Mehr richtige Pole-Tipps</li>
      </ol>
    </section>
  </div>`;
}
