// ========================================
// F1 Kick Tip 2026 – App Bootstrap
// ========================================

import { loadAllData, getQueryParam } from './utils.js';
import { initAuth, isLoggedIn, getSessionUser, getPlayerIdFromSession, signIn, signOut } from './api.js';
import { renderDashboard, renderRaceDetail, renderSeasonPage, renderRulesPage } from './renderer.js';

/**
 * Render the login/logout UI in the header.
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
    const user = getSessionUser();
    const playerId = getPlayerIdFromSession();
    const displayName = user?.name || playerId || 'User';
    li.innerHTML = `
      <span class="auth-user-badge">${displayName}</span>
      <a href="#" class="auth-logout-link">Abmelden</a>
    `;
    li.querySelector('.auth-logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      window.location.reload();
    });
  } else {
    li.innerHTML = `<a href="#" class="auth-login-link">Anmelden</a>`;
    li.querySelector('.auth-login-link').addEventListener('click', (e) => {
      e.preventDefault();
      showLoginModal();
    });
  }

  nav.appendChild(li);
}

/**
 * Show the login modal.
 */
function showLoginModal() {
  // Remove existing modal
  const existing = document.getElementById('login-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'login-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" aria-label="Schließen">&times;</button>
      <h2 class="modal-title">Anmelden</h2>
      <form id="login-form" class="login-form">
        <div class="form-group">
          <label class="form-label" for="login-email">E-Mail</label>
          <input type="email" id="login-email" class="form-input" required autocomplete="email" placeholder="name@example.de">
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Passwort</label>
          <input type="password" id="login-password" class="form-input" required autocomplete="current-password" placeholder="Passwort">
        </div>
        <div id="login-error" class="login-error" hidden></div>
        <button type="submit" class="btn btn-primary login-submit-btn">Anmelden</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Focus email field
  modal.querySelector('#login-email').focus();

  // Form submit
  modal.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = modal.querySelector('#login-email').value.trim();
    const password = modal.querySelector('#login-password').value;
    const errorEl = modal.querySelector('#login-error');
    const submitBtn = modal.querySelector('.login-submit-btn');

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Anmelden...';

    try {
      await signIn(email, password);
      modal.remove();
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message || 'Anmeldung fehlgeschlagen';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Anmelden';
    }
  });
}

// Make showLoginModal available globally for tip forms
window.__showLoginModal = showLoginModal;

async function init() {
  const page = document.body.dataset.page;
  const basePath = document.body.dataset.basePath || undefined;

  // Initialize auth (non-blocking for test mode)
  if (!basePath) {
    await initAuth();
  }

  // Render auth UI on all pages
  renderAuthUI();

  try {
    const data = await loadAllData(basePath);

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
