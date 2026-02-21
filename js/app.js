// ========================================
// F1 Kick Tip 2026 – App Bootstrap
// ========================================

import { loadAllData, getQueryParam } from './utils.js';
import { renderDashboard, renderRaceDetail, renderSeasonPage, renderRulesPage } from './renderer.js';

async function init() {
  const page = document.body.dataset.page;

  try {
    const data = await loadAllData();

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
