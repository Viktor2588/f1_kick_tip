// ========================================
// F1 Kick Tip 2026 – App Bootstrap
// ========================================

import { loadAllData, getQueryParam } from './utils.js';
import { isLoggedIn, getCurrentPlayer, setCurrentPlayer, clearCurrentPlayer, getPlayerIdFromSession } from './api.js';
import { renderHeaderInfo, renderDashboard, renderRaceDetail, renderSeasonPage, renderRulesPage } from './renderer.js';

// Known players (must match season.json)
const KNOWN_PLAYERS = [
  { id: 'thomas', name: 'Thomas', emoji: '\uD83C\uDDE9\uD83C\uDDEA', color: '#FF6B35' },
  { id: 'julia', name: 'Julia', emoji: '\uD83C\uDF1F', color: '#7B2FBE' },
  { id: 'viktor', name: 'Viktor', emoji: '\u26A1', color: '#00B4D8' },
];

/**
 * Render the auth UI in the header (name badge or "Name wählen").
 */
function renderAuthUI() {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;

  // Remove existing auth item
  const existing = nav.querySelector('.nav-auth');
  if (existing) existing.remove();

  const li = document.createElement('li');
  li.className = 'nav-auth';

  if (isLoggedIn()) {
    const playerId = getCurrentPlayer();
    const known = KNOWN_PLAYERS.find(p => p.id === playerId);
    const displayName = known ? `${known.emoji} ${known.name}` : playerId;
    const playerColor = known ? known.color : 'var(--text-muted)';
    li.innerHTML = `
      <button class="auth-player-btn" style="--player-accent: ${playerColor}">
        <span class="auth-player-name">${displayName}</span>
        <svg class="auth-switch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M8 21H3v-5"/><path d="M3 21l7-7"/>
        </svg>
      </button>
    `;
    li.querySelector('.auth-player-btn').addEventListener('click', showPlayerPicker);
  } else {
    li.innerHTML = `<button class="auth-pick-btn">Spieler w\u00E4hlen</button>`;
    li.querySelector('.auth-pick-btn').addEventListener('click', showPlayerPicker);
  }

  nav.appendChild(li);
}

/**
 * Show the player-picker modal.
 */
function showPlayerPicker() {
  // Remove existing modal
  const existing = document.getElementById('player-picker-modal');
  if (existing) existing.remove();

  const currentId = getCurrentPlayer();

  const modal = document.createElement('div');
  modal.id = 'player-picker-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content picker-modal">
      <button class="modal-close" aria-label="Schlie\u00DFen">&times;</button>
      <h2 class="picker-title">Wer bist du?</h2>
      <div class="player-picker-grid">
        ${KNOWN_PLAYERS.map(p => `
          <button class="player-picker-btn${p.id === currentId ? ' is-active' : ''}" data-player-id="${p.id}" style="--player-color: ${p.color}">
            <span class="player-picker-emoji">${p.emoji}</span>
            <span class="player-picker-name">${p.name}</span>
            ${p.id === currentId ? '<span class="player-picker-check">\u2713</span>' : ''}
          </button>
        `).join('')}
      </div>
      <div class="player-picker-divider">
        <span>oder</span>
      </div>
      <div class="player-picker-custom-row">
        <input type="text" id="custom-player-name" class="form-input" placeholder="Anderen Namen eingeben..." maxlength="20">
        <button class="btn btn-primary" id="custom-player-btn">\u2192</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Known player buttons
  modal.querySelectorAll('.player-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentPlayer(btn.dataset.playerId);
      modal.remove();
      renderAuthUI();
      window.location.reload();
    });
  });

  // Custom player
  const customInput = modal.querySelector('#custom-player-name');
  const customBtn = modal.querySelector('#custom-player-btn');

  function submitCustomPlayer() {
    const name = customInput.value.trim().toLowerCase();
    if (!name) return;
    setCurrentPlayer(name);
    modal.remove();
    renderAuthUI();
    window.location.reload();
  }

  customBtn.addEventListener('click', submitCustomPlayer);
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCustomPlayer();
  });
}

// Make showPlayerPicker available globally for tip forms
window.__showLoginModal = showPlayerPicker;

async function init() {
  const page = document.body.dataset.page;
  const basePath = document.body.dataset.basePath || undefined;

  // Render auth UI on all pages
  renderAuthUI();

  try {
    const data = await loadAllData(basePath);

    // Render header info (season progress + countdown) on all pages
    renderHeaderInfo(data);

    switch (page) {
      case 'dashboard':
        renderDashboard(data);
        break;

      case 'rennen': {
        const round = parseInt(getQueryParam('runde'), 10);
        if (isNaN(round)) {
          document.getElementById('race-content').innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">\u2753</div>
              <div class="empty-state-text">Keine Runde angegeben. <a href="index.html">Zurück zum Dashboard</a></div>
            </div>
          `;
          return;
        }
        renderRaceDetail(data, round);
        break;
      }

      case 'saison':
        renderSeasonPage(data);
        break;

      case 'regeln':
        renderRulesPage();
        break;

      default:
        console.warn('Unbekannte Seite:', page);
    }
  } catch (err) {
    console.error('Fehler beim Laden der Daten:', err);
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `
        <div class="container">
          <div class="empty-state">
            <div class="empty-state-icon">\u26a0\ufe0f</div>
            <div class="empty-state-text">Fehler beim Laden der Daten. Bitte Seite neu laden.</div>
          </div>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
