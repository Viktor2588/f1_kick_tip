// ========================================
// F1 Kick Tip 2026 – Admin Module
// ========================================

import { loadAllData, countryFlag, formatDate, driverName, teamName } from './utils.js';

// ── State ──────────────────────────────────────────────
const state = {
  season: null,
  predictions: null,
  results: null,
  sprintPredictions: null,
  sprintResults: null,
  seasonPredictions: null,
  dirty: new Set(),
};

// ── Init ───────────────────────────────────────────────
async function init() {
  try {
    const data = await loadAllData();
    state.season = structuredClone(data.season);
    state.predictions = structuredClone(data.predictions);
    state.results = structuredClone(data.results);
    state.sprintPredictions = structuredClone(data.sprintPredictions);
    state.sprintResults = structuredClone(data.sprintResults);
    state.seasonPredictions = structuredClone(data.seasonPredictions);

    // Ensure top-level keys exist
    if (!state.predictions.predictions) state.predictions.predictions = {};
    if (!state.results.results) state.results.results = {};
    if (!state.sprintPredictions.sprintPredictions) state.sprintPredictions.sprintPredictions = {};
    if (!state.sprintResults.sprintResults) state.sprintResults.sprintResults = {};
    if (!state.seasonPredictions.seasonPredictions) state.seasonPredictions.seasonPredictions = {};

    initTabs();
    initExportButtons();
    renderActiveTab();
    initBeforeUnload();
  } catch (err) {
    console.error('Admin init error:', err);
    document.querySelector('main').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Fehler beim Laden der Daten: ${err.message}</div>
      </div>`;
  }
}

// ── Tabs ───────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
      renderActiveTab();
    });
  });
}

function getActiveTab() {
  return document.querySelector('.admin-tab.active')?.dataset.tab;
}

function renderActiveTab() {
  const tab = getActiveTab();
  switch (tab) {
    case 'results': renderResultsTab(); break;
    case 'predictions': renderPredictionsTab(); break;
    case 'sprint-results': renderSprintResultsTab(); break;
    case 'sprint-predictions': renderSprintPredictionsTab(); break;
    case 'season': renderSeasonTab(); break;
  }
}

// ── Helpers ────────────────────────────────────────────
function driverSelectHTML(name, selected, includeEmpty = true) {
  const opts = includeEmpty ? '<option value="">– Fahrer wählen –</option>' : '';
  const driverOpts = state.season.drivers.map(d =>
    `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.name} (#${d.number})</option>`
  ).join('');
  return `<select class="form-select" name="${name}">${opts}${driverOpts}</select>`;
}

function teamSelectHTML(name, selected, includeEmpty = true) {
  const opts = includeEmpty ? '<option value="">– Team wählen –</option>' : '';
  const teamOpts = state.season.teams.map(t =>
    `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.name}</option>`
  ).join('');
  return `<select class="form-select" name="${name}">${opts}${teamOpts}</select>`;
}

function roundSelectorHTML(races, selectedRound) {
  const opts = races.map(r => {
    const flag = countryFlag(r.countryCode);
    const date = formatDate(r.date);
    const sel = r.round === selectedRound ? 'selected' : '';
    return `<option value="${r.round}" ${sel}>Runde ${r.round}: ${flag} ${r.country} – ${date}</option>`;
  }).join('');
  return `<select class="form-select round-selector">${opts}</select>`;
}

function toDatetimeLocal(utcStr) {
  if (!utcStr) return '';
  const d = new Date(utcStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUTC(localStr) {
  if (!localStr) return new Date().toISOString();
  return new Date(localStr).toISOString();
}

function markDirty(key) {
  state.dirty.add(key);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `admin-notification ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Podium Inputs (3 driver selects for P1, P2, P3) ──
function podiumInputsHTML(prefix, podium) {
  const p = podium || ['', '', ''];
  return `
    <div class="form-group">
      <label class="form-label">Podium P1</label>
      ${driverSelectHTML(`${prefix}_podium_0`, p[0])}
    </div>
    <div class="form-group">
      <label class="form-label">Podium P2</label>
      ${driverSelectHTML(`${prefix}_podium_1`, p[1])}
    </div>
    <div class="form-group">
      <label class="form-label">Podium P3</label>
      ${driverSelectHTML(`${prefix}_podium_2`, p[2])}
    </div>`;
}

// ── Top Ten Input (10 driver selects) ──
function topTenInputsHTML(prefix, topTen) {
  const t = topTen || Array(10).fill('');
  return t.map((d, i) => `
    <div class="form-group">
      <label class="form-label">P${i + 1}</label>
      ${driverSelectHTML(`${prefix}_topten_${i}`, d)}
    </div>`).join('');
}

// ════════════════════════════════════════════════════════
// TAB 1: Rennergebnisse
// ════════════════════════════════════════════════════════
function renderResultsTab() {
  const panel = document.getElementById('panel-results');
  const races = state.season.races;
  const selectedRound = parseInt(panel.dataset.round) || races[0].round;

  panel.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-lg);">
      <div class="form-group">
        <label class="form-label">Runde auswählen</label>
        ${roundSelectorHTML(races, selectedRound)}
      </div>
    </div>
    <div id="results-form-area"></div>`;

  panel.querySelector('.round-selector').addEventListener('change', e => {
    panel.dataset.round = e.target.value;
    renderResultsForm(parseInt(e.target.value));
  });

  renderResultsForm(selectedRound);
}

function renderResultsForm(round) {
  const area = document.getElementById('results-form-area');
  const roundStr = String(round);
  const result = state.results.results[roundStr] || {};
  const race = state.season.races.find(r => r.round === round);

  area.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom: var(--space-lg);">
        ${countryFlag(race.countryCode)} ${race.name} – Ergebnis
      </h3>
      <form id="result-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">Sieger</label>
          ${driverSelectHTML('winner', result.winner)}
        </div>
        ${podiumInputsHTML('result', result.podium)}
        <div class="form-group">
          <label class="form-label">Pole Position</label>
          ${driverSelectHTML('pole', result.pole)}
        </div>
        <div class="form-group">
          <label class="form-label">Schnellste Runde</label>
          ${driverSelectHTML('fastestLap', result.fastestLap)}
        </div>
        <div class="form-group">
          <label class="form-label">Bester Konstrukteur</label>
          ${teamSelectHTML('bestConstructor', result.bestConstructor)}
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Eingabe-Zeitpunkt</label>
          <input type="datetime-local" class="form-input" name="enteredAt"
                 value="${toDatetimeLocal(result.enteredAt)}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <details>
            <summary style="cursor:pointer; color: var(--text-secondary); font-size: 0.9rem;">
              Top 10 (optional)
            </summary>
            <div class="admin-form-grid" style="margin-top: var(--space-md);">
              ${topTenInputsHTML('result', result.topTen)}
            </div>
          </details>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Ergebnis speichern</button>
          <button type="button" class="btn btn-danger" id="clear-result">Ergebnis löschen</button>
        </div>
      </form>
    </div>`;

  area.querySelector('#result-form').addEventListener('submit', e => {
    e.preventDefault();
    saveResult(round);
  });

  area.querySelector('#clear-result').addEventListener('click', () => {
    if (confirm(`Ergebnis für Runde ${round} wirklich löschen?`)) {
      delete state.results.results[roundStr];
      markDirty('results');
      showToast(`Ergebnis Runde ${round} gelöscht`, 'info');
      renderResultsForm(round);
    }
  });
}

function saveResult(round) {
  const form = document.getElementById('result-form');
  const fd = new FormData(form);
  const roundStr = String(round);

  const winner = fd.get('winner');
  if (!winner) { showToast('Bitte Sieger auswählen', 'error'); return; }

  const podium = [
    fd.get('result_podium_0'),
    fd.get('result_podium_1'),
    fd.get('result_podium_2'),
  ];

  const topTen = [];
  for (let i = 0; i < 10; i++) {
    const v = fd.get(`result_topten_${i}`);
    if (v) topTen.push(v);
  }

  state.results.results[roundStr] = {
    winner,
    podium,
    pole: fd.get('pole') || '',
    fastestLap: fd.get('fastestLap') || '',
    bestConstructor: fd.get('bestConstructor') || '',
    topTen: topTen.length > 0 ? topTen : undefined,
    enteredAt: toUTC(fd.get('enteredAt')),
  };

  // Remove undefined topTen
  if (!state.results.results[roundStr].topTen) {
    delete state.results.results[roundStr].topTen;
  }

  markDirty('results');
  showToast(`Ergebnis Runde ${round} gespeichert`);
}

// ════════════════════════════════════════════════════════
// TAB 2: Renntipps
// ════════════════════════════════════════════════════════
function renderPredictionsTab() {
  const panel = document.getElementById('panel-predictions');
  const races = state.season.races;
  const selectedRound = parseInt(panel.dataset.round) || races[0].round;

  panel.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-lg);">
      <div class="form-group">
        <label class="form-label">Runde auswählen</label>
        ${roundSelectorHTML(races, selectedRound)}
      </div>
    </div>
    <div id="predictions-form-area"></div>`;

  panel.querySelector('.round-selector').addEventListener('change', e => {
    panel.dataset.round = e.target.value;
    renderPredictionsForm(parseInt(e.target.value));
  });

  renderPredictionsForm(selectedRound);
}

function renderPredictionsForm(round) {
  const area = document.getElementById('predictions-form-area');
  const roundStr = String(round);
  const roundPreds = state.predictions.predictions[roundStr] || {};
  const race = state.season.races.find(r => r.round === round);

  let html = '';
  for (const player of state.season.players) {
    const pred = roundPreds[player.id] || {};
    html += `
      <div class="card admin-player-form" style="border-left: 4px solid ${player.color}; margin-bottom: var(--space-md);">
        <h3 style="margin-bottom: var(--space-md);">
          ${player.emoji} ${player.name}
        </h3>
        <form class="admin-form-grid prediction-form" data-player="${player.id}">
          <div class="form-group">
            <label class="form-label">Sieger</label>
            ${driverSelectHTML(`winner`, pred.winner)}
          </div>
          ${podiumInputsHTML(player.id, pred.podium)}
          <div class="form-group">
            <label class="form-label">Pole Position</label>
            ${driverSelectHTML(`pole`, pred.pole)}
          </div>
          <div class="form-group">
            <label class="form-label">Schnellste Runde</label>
            ${driverSelectHTML(`fastestLap`, pred.fastestLap)}
          </div>
          <div class="form-group">
            <label class="form-label">Bester Konstrukteur</label>
            ${teamSelectHTML(`bestConstructor`, pred.bestConstructor)}
          </div>
          <div class="form-group">
            <label class="form-label">Abgabe-Zeitpunkt</label>
            <input type="datetime-local" class="form-input" name="submittedAt"
                   value="${toDatetimeLocal(pred.submittedAt)}">
          </div>
        </form>
      </div>`;
  }

  html += `
    <div class="form-actions" style="margin-top: var(--space-md);">
      <button class="btn btn-primary" id="save-predictions">Alle Tipps speichern</button>
    </div>`;

  area.innerHTML = html;

  area.querySelector('#save-predictions').addEventListener('click', () => {
    savePredictions(round);
  });
}

function savePredictions(round) {
  const roundStr = String(round);
  if (!state.predictions.predictions[roundStr]) {
    state.predictions.predictions[roundStr] = {};
  }

  const forms = document.querySelectorAll('.prediction-form');
  for (const form of forms) {
    const playerId = form.dataset.player;
    const fd = new FormData(form);

    const winner = fd.get('winner');
    if (!winner) continue; // Skip empty predictions

    state.predictions.predictions[roundStr][playerId] = {
      winner,
      podium: [
        fd.get(`${playerId}_podium_0`) || '',
        fd.get(`${playerId}_podium_1`) || '',
        fd.get(`${playerId}_podium_2`) || '',
      ],
      pole: fd.get('pole') || '',
      fastestLap: fd.get('fastestLap') || '',
      bestConstructor: fd.get('bestConstructor') || '',
      submittedAt: toUTC(fd.get('submittedAt')),
    };
  }

  markDirty('predictions');
  showToast(`Tipps Runde ${round} gespeichert`);
}

// ════════════════════════════════════════════════════════
// TAB 3: Sprint-Ergebnisse
// ════════════════════════════════════════════════════════
function renderSprintResultsTab() {
  const panel = document.getElementById('panel-sprint-results');
  const sprintRaces = state.season.races.filter(r => r.sprint);
  const selectedRound = parseInt(panel.dataset.round) || (sprintRaces[0]?.round ?? 0);

  if (sprintRaces.length === 0) {
    panel.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-text">Keine Sprint-Rennen in dieser Saison.</div></div></div>';
    return;
  }

  panel.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-lg);">
      <div class="form-group">
        <label class="form-label">Sprint-Runde auswählen</label>
        ${roundSelectorHTML(sprintRaces, selectedRound)}
      </div>
    </div>
    <div id="sprint-results-form-area"></div>`;

  panel.querySelector('.round-selector').addEventListener('change', e => {
    panel.dataset.round = e.target.value;
    renderSprintResultsForm(parseInt(e.target.value));
  });

  renderSprintResultsForm(selectedRound);
}

function renderSprintResultsForm(round) {
  const area = document.getElementById('sprint-results-form-area');
  const roundStr = String(round);
  const result = state.sprintResults.sprintResults[roundStr] || {};
  const race = state.season.races.find(r => r.round === round);

  area.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom: var(--space-lg);">
        ${countryFlag(race.countryCode)} ${race.name} – Sprint-Ergebnis
        <span class="sprint-badge">Sprint</span>
      </h3>
      <form id="sprint-result-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">Sieger</label>
          ${driverSelectHTML('winner', result.winner)}
        </div>
        ${podiumInputsHTML('sprint', result.podium)}
        <div class="form-group">
          <label class="form-label">Eingabe-Zeitpunkt</label>
          <input type="datetime-local" class="form-input" name="enteredAt"
                 value="${toDatetimeLocal(result.enteredAt)}">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Sprint-Ergebnis speichern</button>
          <button type="button" class="btn btn-danger" id="clear-sprint-result">Löschen</button>
        </div>
      </form>
    </div>`;

  area.querySelector('#sprint-result-form').addEventListener('submit', e => {
    e.preventDefault();
    saveSprintResult(round);
  });

  area.querySelector('#clear-sprint-result').addEventListener('click', () => {
    if (confirm(`Sprint-Ergebnis für Runde ${round} wirklich löschen?`)) {
      delete state.sprintResults.sprintResults[roundStr];
      markDirty('sprintResults');
      showToast(`Sprint-Ergebnis Runde ${round} gelöscht`, 'info');
      renderSprintResultsForm(round);
    }
  });
}

function saveSprintResult(round) {
  const form = document.getElementById('sprint-result-form');
  const fd = new FormData(form);
  const roundStr = String(round);

  const winner = fd.get('winner');
  if (!winner) { showToast('Bitte Sieger auswählen', 'error'); return; }

  state.sprintResults.sprintResults[roundStr] = {
    winner,
    podium: [
      fd.get('sprint_podium_0') || '',
      fd.get('sprint_podium_1') || '',
      fd.get('sprint_podium_2') || '',
    ],
    enteredAt: toUTC(fd.get('enteredAt')),
  };

  markDirty('sprintResults');
  showToast(`Sprint-Ergebnis Runde ${round} gespeichert`);
}

// ════════════════════════════════════════════════════════
// TAB 4: Sprint-Tipps
// ════════════════════════════════════════════════════════
function renderSprintPredictionsTab() {
  const panel = document.getElementById('panel-sprint-predictions');
  const sprintRaces = state.season.races.filter(r => r.sprint);
  const selectedRound = parseInt(panel.dataset.round) || (sprintRaces[0]?.round ?? 0);

  if (sprintRaces.length === 0) {
    panel.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-text">Keine Sprint-Rennen in dieser Saison.</div></div></div>';
    return;
  }

  panel.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-lg);">
      <div class="form-group">
        <label class="form-label">Sprint-Runde auswählen</label>
        ${roundSelectorHTML(sprintRaces, selectedRound)}
      </div>
    </div>
    <div id="sprint-predictions-form-area"></div>`;

  panel.querySelector('.round-selector').addEventListener('change', e => {
    panel.dataset.round = e.target.value;
    renderSprintPredictionsForm(parseInt(e.target.value));
  });

  renderSprintPredictionsForm(selectedRound);
}

function renderSprintPredictionsForm(round) {
  const area = document.getElementById('sprint-predictions-form-area');
  const roundStr = String(round);
  const roundPreds = state.sprintPredictions.sprintPredictions[roundStr] || {};
  const race = state.season.races.find(r => r.round === round);

  let html = '';
  for (const player of state.season.players) {
    const pred = roundPreds[player.id] || {};
    html += `
      <div class="card admin-player-form" style="border-left: 4px solid ${player.color}; margin-bottom: var(--space-md);">
        <h3 style="margin-bottom: var(--space-md);">
          ${player.emoji} ${player.name}
          <span class="sprint-badge">Sprint</span>
        </h3>
        <form class="admin-form-grid sprint-prediction-form" data-player="${player.id}">
          <div class="form-group">
            <label class="form-label">Sieger</label>
            ${driverSelectHTML('winner', pred.winner)}
          </div>
          ${podiumInputsHTML(`sp_${player.id}`, pred.podium)}
          <div class="form-group">
            <label class="form-label">Abgabe-Zeitpunkt</label>
            <input type="datetime-local" class="form-input" name="submittedAt"
                   value="${toDatetimeLocal(pred.submittedAt)}">
          </div>
        </form>
      </div>`;
  }

  html += `
    <div class="form-actions" style="margin-top: var(--space-md);">
      <button class="btn btn-primary" id="save-sprint-predictions">Alle Sprint-Tipps speichern</button>
    </div>`;

  area.innerHTML = html;

  area.querySelector('#save-sprint-predictions').addEventListener('click', () => {
    saveSprintPredictions(round);
  });
}

function saveSprintPredictions(round) {
  const roundStr = String(round);
  if (!state.sprintPredictions.sprintPredictions[roundStr]) {
    state.sprintPredictions.sprintPredictions[roundStr] = {};
  }

  const forms = document.querySelectorAll('.sprint-prediction-form');
  for (const form of forms) {
    const playerId = form.dataset.player;
    const fd = new FormData(form);

    const winner = fd.get('winner');
    if (!winner) continue;

    state.sprintPredictions.sprintPredictions[roundStr][playerId] = {
      winner,
      podium: [
        fd.get(`sp_${playerId}_podium_0`) || '',
        fd.get(`sp_${playerId}_podium_1`) || '',
        fd.get(`sp_${playerId}_podium_2`) || '',
      ],
      submittedAt: toUTC(fd.get('submittedAt')),
    };
  }

  markDirty('sprintPredictions');
  showToast(`Sprint-Tipps Runde ${round} gespeichert`);
}

// ════════════════════════════════════════════════════════
// TAB 5: Saison & Spieler
// ════════════════════════════════════════════════════════
function renderSeasonTab() {
  const panel = document.getElementById('panel-season');

  // Season predictions per player
  let seasonHtml = '<h2 class="section-title">Saison-Tipps (WDC / WCC)</h2>';
  for (const player of state.season.players) {
    const pred = state.seasonPredictions.seasonPredictions[player.id] || {};
    seasonHtml += `
      <div class="card admin-player-form" style="border-left: 4px solid ${player.color}; margin-bottom: var(--space-md);">
        <h3 style="margin-bottom: var(--space-md);">${player.emoji} ${player.name}</h3>
        <form class="admin-form-grid season-prediction-form" data-player="${player.id}">
          <div class="form-group">
            <label class="form-label">WDC (Weltmeister Fahrer)</label>
            ${driverSelectHTML('wdc', pred.wdc)}
          </div>
          <div class="form-group">
            <label class="form-label">WCC (Weltmeister Konstrukteur)</label>
            ${teamSelectHTML('wcc', pred.wcc)}
          </div>
          <div class="form-group">
            <label class="form-label">Abgabe-Zeitpunkt</label>
            <input type="datetime-local" class="form-input" name="submittedAt"
                   value="${toDatetimeLocal(pred.submittedAt)}">
          </div>
        </form>
      </div>`;
  }

  seasonHtml += `
    <div class="form-actions" style="margin-bottom: var(--space-2xl);">
      <button class="btn btn-primary" id="save-season-predictions">Saison-Tipps speichern</button>
    </div>`;

  // Player management
  seasonHtml += `
    <h2 class="section-title">Spieler-Verwaltung</h2>
    <div id="player-list"></div>
    <div class="card" style="margin-top: var(--space-md);">
      <h3 style="margin-bottom: var(--space-md);">Neuen Spieler hinzufügen</h3>
      <form id="add-player-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">ID (lowercase, keine Leerzeichen)</label>
          <input type="text" class="form-input" name="id" placeholder="z.B. max" pattern="[a-z0-9]+" required>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" name="name" placeholder="z.B. Max" required>
        </div>
        <div class="form-group">
          <label class="form-label">Emoji</label>
          <input type="text" class="form-input" name="emoji" placeholder="z.B. 🚀" required>
        </div>
        <div class="form-group">
          <label class="form-label">Farbe (Hex)</label>
          <input type="color" class="form-input" name="color" value="#FF6B35" style="height: 42px; padding: 4px;">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Spieler hinzufügen</button>
        </div>
      </form>
    </div>`;

  panel.innerHTML = seasonHtml;

  renderPlayerList();

  panel.querySelector('#save-season-predictions').addEventListener('click', saveSeasonPredictions);
  panel.querySelector('#add-player-form').addEventListener('submit', e => {
    e.preventDefault();
    addPlayer();
  });
}

function renderPlayerList() {
  const container = document.getElementById('player-list');
  let html = '';
  for (const player of state.season.players) {
    html += `
      <div class="card admin-player-row" style="border-left: 4px solid ${player.color}; margin-bottom: var(--space-sm);">
        <div class="flex-between">
          <div>
            <span style="font-size: 1.2rem;">${player.emoji}</span>
            <strong>${player.name}</strong>
            <span class="text-muted" style="font-size: 0.8rem; margin-left: var(--space-sm);">${player.id}</span>
            <span style="display: inline-block; width: 14px; height: 14px; background: ${player.color}; border-radius: 50%; vertical-align: middle; margin-left: var(--space-sm);"></span>
          </div>
          <button class="btn btn-danger btn-sm" data-remove-player="${player.id}">Entfernen</button>
        </div>
      </div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('[data-remove-player]').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.removePlayer));
  });
}

function saveSeasonPredictions() {
  const forms = document.querySelectorAll('.season-prediction-form');
  for (const form of forms) {
    const playerId = form.dataset.player;
    const fd = new FormData(form);

    const wdc = fd.get('wdc');
    const wcc = fd.get('wcc');
    if (!wdc && !wcc) continue;

    state.seasonPredictions.seasonPredictions[playerId] = {
      wdc: wdc || '',
      wcc: wcc || '',
      submittedAt: toUTC(fd.get('submittedAt')),
    };
  }

  markDirty('seasonPredictions');
  showToast('Saison-Tipps gespeichert');
}

function addPlayer() {
  const form = document.getElementById('add-player-form');
  const fd = new FormData(form);
  const id = fd.get('id').trim().toLowerCase();
  const name = fd.get('name').trim();
  const emoji = fd.get('emoji').trim();
  const color = fd.get('color');

  if (!id || !name || !emoji) {
    showToast('Alle Felder ausfüllen', 'error');
    return;
  }

  if (state.season.players.some(p => p.id === id)) {
    showToast(`Spieler "${id}" existiert bereits`, 'error');
    return;
  }

  state.season.players.push({ id, name, emoji, color });
  markDirty('season');
  showToast(`Spieler "${name}" hinzugefügt`);
  form.reset();
  renderSeasonTab();
}

function removePlayer(playerId) {
  const player = state.season.players.find(p => p.id === playerId);
  if (!player) return;

  if (!confirm(`Spieler "${player.name}" wirklich entfernen? Alle Tipps dieses Spielers werden gelöscht.`)) return;

  // Remove from players array
  state.season.players = state.season.players.filter(p => p.id !== playerId);
  markDirty('season');

  // Remove from predictions (all rounds)
  for (const roundStr of Object.keys(state.predictions.predictions)) {
    delete state.predictions.predictions[roundStr][playerId];
  }
  markDirty('predictions');

  // Remove from sprint predictions (all rounds)
  for (const roundStr of Object.keys(state.sprintPredictions.sprintPredictions)) {
    delete state.sprintPredictions.sprintPredictions[roundStr][playerId];
  }
  markDirty('sprintPredictions');

  // Remove from season predictions
  delete state.seasonPredictions.seasonPredictions[playerId];
  markDirty('seasonPredictions');

  showToast(`Spieler "${player.name}" entfernt`, 'info');
  renderSeasonTab();
}

// ════════════════════════════════════════════════════════
// Export
// ════════════════════════════════════════════════════════
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getExportData(key) {
  switch (key) {
    case 'results': return { filename: 'results.json', data: state.results };
    case 'predictions': return { filename: 'predictions.json', data: state.predictions };
    case 'sprint-results': return { filename: 'sprint-results.json', data: state.sprintResults };
    case 'sprint-predictions': return { filename: 'sprint-predictions.json', data: state.sprintPredictions };
    case 'season-predictions': return { filename: 'season-predictions.json', data: state.seasonPredictions };
    case 'season': return { filename: 'season.json', data: state.season };
    default: return null;
  }
}

function exportAll() {
  const keys = ['results', 'predictions', 'sprint-results', 'sprint-predictions', 'season-predictions', 'season'];
  keys.forEach((key, i) => {
    setTimeout(() => {
      const exp = getExportData(key);
      if (exp) downloadJSON(exp.filename, exp.data);
    }, i * 300);
  });
  showToast('Alle Dateien werden heruntergeladen...');
}

function initExportButtons() {
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.export;
      if (key === 'all') {
        exportAll();
      } else {
        const exp = getExportData(key);
        if (exp) {
          downloadJSON(exp.filename, exp.data);
          showToast(`${exp.filename} heruntergeladen`);
        }
      }
    });
  });
}

// ── Before Unload Guard ────────────────────────────────
function initBeforeUnload() {
  window.addEventListener('beforeunload', e => {
    if (state.dirty.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ── Start ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
