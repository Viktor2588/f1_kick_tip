// ========================================
// F1 Kick Tip 2026 – DOM Renderer
// ========================================

import {
  driverName, driverLastName, teamName, teamColorForDriver,
  countryFlag, formatDate, formatDateShort, formatDateTime,
  getRaceStatus, getDeadlineStatus, getSprintDeadlineStatus,
  getNextRace, completedRaceCount, countdown, getRecentRaces,
  getPlayer, getRace, pad, isLate,
} from './utils.js';

import {
  scoreRace, scoreSprint, calculateStandings, calculateAccuracy,
  isPerfectRound, isPerfectSprint,
} from './scoring.js';

import {
  isLoggedIn, getPlayerIdFromSession,
  submitRacePrediction, submitSprintPrediction, submitSeasonPrediction,
} from './api.js';

// ---- Header Info (all pages) ----

export function renderHeaderInfo(data) {
  const container = document.getElementById('header-info');
  if (!container) return;

  const { season, results } = data;
  const total = season.races.length;
  const completed = completedRaceCount(results);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const next = getNextRace(season, results);

  let nextHtml = '';
  if (next) {
    function update() {
      const cd = countdown(next.raceStartUTC);
      const timerStr = cd.expired ? 'Läuft!'
        : `${cd.days}T ${pad(cd.hours)}:${pad(cd.minutes)}:${pad(cd.seconds)}`;
      container.querySelector('.header-info-timer').textContent = timerStr;
    }

    nextHtml = `
      <span class="header-info-next">
        ${countryFlag(next.countryCode)} ${next.name}
        ${next.sprint ? '<span class="sprint-badge">Sprint</span>' : ''}
        <span class="header-info-timer">...</span>
      </span>
    `;

    container.innerHTML = `<div class="header-info">
      <span class="header-info-progress">${completed}/${total} Rennen
        <span class="progress-bar"><span class="progress-fill" style="width:${pct}%"></span></span>
      </span>
      ${nextHtml}
    </div>`;

    update();
    setInterval(update, 1000);
  } else {
    container.innerHTML = `<div class="header-info">
      <span class="header-info-progress">${completed}/${total} Rennen
        <span class="progress-bar"><span class="progress-fill" style="width:${pct}%"></span></span>
      </span>
      <span class="header-info-next">Saison abgeschlossen!</span>
    </div>`;
  }
}

// ---- Dashboard (index.html) ----

export function renderDashboard(data) {
  const { season, predictions, sprintPredictions, seasonPredictions, results, sprintResults } = data;
  const standings = calculateStandings(
    season, predictions, sprintPredictions, results, sprintResults, seasonPredictions, null
  );

  renderLeaderboard(season, standings);
  renderTipStatus(season, predictions, sprintPredictions, seasonPredictions, results);
  renderRecentResults(season, predictions, results, standings, data);
  renderCalendar(season, results);
  renderSeasonTips(season, seasonPredictions, results);
}

function renderLeaderboard(season, standings) {
  const container = document.getElementById('leaderboard');
  if (!container) return;

  container.innerHTML = standings.map((s, idx) => {
    const player = getPlayer(season, s.playerId);
    const accuracy = calculateAccuracy(s.raceScores, s.sprintScores);

    return `
      <div class="card player-card fade-in" data-player="${s.playerId}" style="animation-delay: ${idx * 100}ms">
        <span class="player-rank">#${idx + 1}</span>
        <div class="player-name">${player.emoji} ${player.name}</div>
        <div class="player-points">${s.totalPoints} Pkt.</div>
        <div class="player-stats">
          <div>
            <span class="player-stat-value">${accuracy}%</span>
            Genauigkeit
          </div>
          <div>
            <span class="player-stat-value">${s.perfectRounds}</span>
            Perfekte Runden
          </div>
          <div>
            <span class="player-stat-value">${s.correctWinners}</span>
            Sieger richtig
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTipStatus(season, predictions, sprintPredictions, seasonPredictions, results) {
  const container = document.getElementById('tip-status');
  if (!container) return;

  const players = season.players;
  const nextRace = getNextRace(season, results);
  const preds = predictions.predictions || {};
  const sprintPreds = sprintPredictions.sprintPredictions || {};
  const seasonPreds = seasonPredictions.seasonPredictions || {};

  let cards = '';

  // Next race tip status
  if (nextRace) {
    const roundStr = String(nextRace.round);
    const roundPreds = preds[roundStr] || {};
    cards += `
      <div class="card tip-status-card">
        <h4>${countryFlag(nextRace.countryCode)} Runde ${nextRace.round} – ${nextRace.name}</h4>
        <div class="tip-status-list">
          ${players.map(p => {
            const hasTip = !!roundPreds[p.id];
            return `<div class="tip-status-row">
              <span>${p.emoji} ${p.name}</span>
              <span class="tip-status-badge ${hasTip ? 'tipped' : 'missing'}">${hasTip ? 'Getippt' : 'Fehlt'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    // Sprint tip status (if sprint weekend)
    if (nextRace.sprint) {
      const sprintRoundPreds = sprintPreds[roundStr] || {};
      cards += `
        <div class="card tip-status-card">
          <h4>${countryFlag(nextRace.countryCode)} Sprint – Runde ${nextRace.round}</h4>
          <div class="tip-status-list">
            ${players.map(p => {
              const hasTip = !!sprintRoundPreds[p.id];
              return `<div class="tip-status-row">
                <span>${p.emoji} ${p.name}</span>
                <span class="tip-status-badge ${hasTip ? 'tipped' : 'missing'}">${hasTip ? 'Getippt' : 'Fehlt'}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
    }
  }

  // Season tip status
  cards += `
    <div class="card tip-status-card">
      <h4>Saison-Tipps (WDC & WCC)</h4>
      <div class="tip-status-list">
        ${players.map(p => {
          const hasTip = !!seasonPreds[p.id];
          return `<div class="tip-status-row">
            <span>${p.emoji} ${p.name}</span>
            <span class="tip-status-badge ${hasTip ? 'tipped' : 'missing'}">${hasTip ? 'Getippt' : 'Fehlt'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = `<div class="tip-status-grid">${cards}</div>`;
}

function renderRecentResults(season, predictions, results, standings, data) {
  const container = document.getElementById('recent-results');
  if (!container) return;

  const recentRaces = getRecentRaces(season, results, 3);

  if (recentRaces.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\ud83c\udfc1</div>
        <div class="empty-state-text">Noch keine Ergebnisse vorhanden</div>
      </div>
    `;
    return;
  }

  container.innerHTML = recentRaces.map(race => {
    const roundStr = String(race.round);
    const result = results.results[roundStr];
    const winnerName = driverLastName(season, result.winner);

    // Find who won the tip game for this race
    let bestPlayer = null;
    let bestPoints = -1;
    for (const player of season.players) {
      const pred = predictions.predictions?.[roundStr]?.[player.id];
      if (pred) {
        const score = scoreRace(pred, result, race);
        if (score.total > bestPoints) {
          bestPoints = score.total;
          bestPlayer = player;
        }
      }
    }

    return `
      <a href="rennen.html?runde=${race.round}" class="card recent-result-card">
        <div class="calendar-round">Runde ${race.round}</div>
        <div class="flex-between mt-md">
          <div>
            <div>${countryFlag(race.countryCode)} ${race.country}</div>
            <div class="winner-name">\ud83c\udfc6 ${winnerName}</div>
          </div>
          ${bestPlayer ? `<div class="tip-winner">${bestPlayer.emoji} ${bestPlayer.name}<br>${bestPoints} Pkt.</div>` : ''}
        </div>
      </a>
    `;
  }).join('');
}

function renderCalendar(season, results) {
  const container = document.getElementById('calendar');
  if (!container) return;

  const now = new Date();
  let activeFound = false;

  container.innerHTML = season.races.map(race => {
    const roundStr = String(race.round);
    const hasResult = results.results && results.results[roundStr];
    let statusClass = 'upcoming';
    if (hasResult) {
      statusClass = 'finished';
    } else if (!activeFound) {
      statusClass = 'active';
      activeFound = true;
    }

    return `
      <a href="rennen.html?runde=${race.round}" class="calendar-race ${statusClass}">
        ${race.sprint ? '<span class="calendar-sprint"><span class="sprint-badge">Sprint</span></span>' : ''}
        <div class="calendar-round">Runde ${race.round}</div>
        <div class="calendar-flag">${countryFlag(race.countryCode)}</div>
        <div class="calendar-country">${race.country}</div>
        <div class="calendar-date">${formatDateShort(race.date)}</div>
      </a>
    `;
  }).join('');
}

function renderSeasonTips(season, seasonPredictions, results) {
  const container = document.getElementById('season-tips');
  if (!container) return;

  const preds = seasonPredictions.seasonPredictions || {};

  if (Object.keys(preds).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\ud83c\udfaf</div>
        <div class="empty-state-text">Noch keine Saison-Tipps abgegeben</div>
      </div>
    `;
    return;
  }

  // Check if round 1 deadline has passed (reveal tips only after that)
  const round1 = getRace(season, 1);
  const now = new Date();
  const revealed = !round1 || now >= new Date(round1.raceStartUTC);

  container.innerHTML = `
    ${!revealed ? '<div class="text-muted mb-md" style="font-size: var(--font-sm);">Tipps werden nach Start von Runde 1 aufgedeckt</div>' : ''}
    <div class="season-tip-grid">
      ${season.players.map(player => {
        const pred = preds[player.id];
        if (!pred) return `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name">${player.emoji} ${player.name}</div>
            <div class="text-muted mt-md">Kein Tipp abgegeben</div>
          </div>
        `;
        if (!revealed) return `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name">${player.emoji} ${player.name}</div>
            <div class="mt-md">
              <div class="season-tip-label">Weltmeister (WDC)</div>
              <div class="season-tip-value masked-tip">Abgegeben</div>
            </div>
            <div class="mt-md">
              <div class="season-tip-label">Konstrukteurs-WM (WCC)</div>
              <div class="season-tip-value masked-tip">Abgegeben</div>
            </div>
          </div>
        `;
        return `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name">${player.emoji} ${player.name}</div>
            <div class="mt-md">
              <div class="season-tip-label">Weltmeister (WDC)</div>
              <div class="season-tip-value" style="color: ${teamColorForDriver(season, pred.wdc)}">
                ${driverName(season, pred.wdc)}
              </div>
            </div>
            <div class="mt-md">
              <div class="season-tip-label">Konstrukteurs-WM (WCC)</div>
              <div class="season-tip-value">${teamName(season, pred.wcc)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ---- Race Detail (rennen.html) ----

export function renderRaceDetail(data, round) {
  const { season, predictions, sprintPredictions, seasonPredictions, results, sprintResults } = data;
  const race = getRace(season, round);

  if (!race) {
    document.getElementById('race-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\u2753</div>
        <div class="empty-state-text">Rennen nicht gefunden</div>
      </div>
    `;
    return;
  }

  renderRaceHeader(season, race, results);
  renderRaceCountdown(race, results);
  renderTipForm(season, race, predictions, results, data);
  if (race.sprint) {
    renderSprintTipForm(season, race, sprintPredictions, sprintResults, data);
  }
  renderRacePredictions(season, race, predictions, results);
  if (race.sprint) {
    renderSprintPredictions(season, race, sprintPredictions, sprintResults);
  }
  renderRaceResult(season, race, results);
  renderRacePointsBreakdown(season, race, predictions, results, sprintPredictions, sprintResults);
}

function renderRaceHeader(season, race, results) {
  const container = document.getElementById('race-header');
  if (!container) return;

  const status = getDeadlineStatus(race, results);
  const statusLabel = { open: 'Offen', locked: 'Gesperrt', finished: 'Abgeschlossen' }[status];
  const statusClass = { open: 'status-open', locked: 'status-locked', finished: 'status-finished' }[status];

  container.innerHTML = `
    <div class="race-header">
      <div class="race-flag">${countryFlag(race.countryCode)}</div>
      <h1 class="race-name">${race.name}</h1>
      <div class="race-info">
        ${race.circuit} \u2022 ${race.city} \u2022 ${formatDate(race.date)}
        ${race.sprint ? ' <span class="sprint-badge">Sprint</span>' : ''}
      </div>
    </div>
  `;
}

function renderRaceCountdown(race, results) {
  const container = document.getElementById('race-countdown');
  if (!container) return;

  const status = getDeadlineStatus(race, results);
  const statusLabel = { open: 'Offen', locked: 'Gesperrt', finished: 'Abgeschlossen' }[status];
  const statusClass = { open: 'status-open', locked: 'status-locked', finished: 'status-finished' }[status];

  if (status === 'finished') {
    container.innerHTML = `
      <div class="race-countdown-card">
        <div class="countdown">
          <div class="countdown-label">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (status === 'locked') {
    container.innerHTML = `
      <div class="race-countdown-card">
        <div class="countdown">
          <div class="countdown-label">
            Tipp-Deadline abgelaufen
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  function update() {
    const cd = countdown(race.raceStartUTC);
    if (cd.expired) {
      container.innerHTML = `
        <div class="race-countdown-card">
          <div class="countdown">
            <div class="countdown-label">Tipp-Deadline abgelaufen</div>
          </div>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <div class="race-countdown-card">
        <div class="countdown">
          <div class="countdown-label">
            Deadline: Rennstart
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="countdown-timer">
            <div class="countdown-unit">
              <span class="countdown-value">${pad(cd.days)}</span>
              <span class="countdown-unit-label">Tage</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${pad(cd.hours)}</span>
              <span class="countdown-unit-label">Std</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${pad(cd.minutes)}</span>
              <span class="countdown-unit-label">Min</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${pad(cd.seconds)}</span>
              <span class="countdown-unit-label">Sek</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  update();
  setInterval(update, 1000);
}

function renderRacePredictions(season, race, predictions, results) {
  const container = document.getElementById('race-predictions');
  if (!container) return;

  const roundStr = String(race.round);
  const result = results.results?.[roundStr] || null;
  const players = season.players;

  // Check if anyone has predictions
  const roundPreds = predictions.predictions?.[roundStr] || {};
  if (Object.keys(roundPreds).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\ud83d\udcdd</div>
        <div class="empty-state-text">Noch keine Tipps abgegeben</div>
      </div>
    `;
    return;
  }

  const categories = [
    { key: 'winner', label: 'Rennsieger (= P1)', format: id => driverLastName(season, id) },
    { key: 'podium-2', label: 'Podium P2', format: (_, pred) => pred?.podium?.[1] ? driverLastName(season, pred.podium[1]) : '-' },
    { key: 'podium-3', label: 'Podium P3', format: (_, pred) => pred?.podium?.[2] ? driverLastName(season, pred.podium[2]) : '-' },
    { key: 'pole', label: 'Pole Position', format: id => driverLastName(season, id) },
    { key: 'fastestLap', label: 'Schnellste Runde', format: id => driverLastName(season, id) },
    { key: 'bestConstructor', label: 'Bester Konstrukteur', format: id => teamName(season, id) },
  ];

  let html = `<table class="comparison-table">
    <thead><tr>
      <th>Kategorie</th>
      ${players.map(p => `<th data-player="${p.id}">${p.emoji} ${p.name}</th>`).join('')}
      ${result ? '<th>Ergebnis</th>' : ''}
    </tr></thead><tbody>`;

  for (const cat of categories) {
    html += '<tr>';
    html += `<td>${cat.label}</td>`;

    for (const player of players) {
      const pred = roundPreds[player.id];
      let value = '-';
      let cssClass = '';
      let icon = '';

      if (pred) {
        const late = isLate(pred.submittedAt, race.raceStartUTC);

        if (cat.key === 'podium-2' || cat.key === 'podium-3') {
          value = cat.format(null, pred);
        } else {
          value = pred[cat.key] ? cat.format(pred[cat.key]) : '-';
        }

        if (late) {
          cssClass = 'result-wrong';
          icon = ' <span class="late-badge">Verspätet</span>';
        } else if (result) {
          const isCorrect = checkCategoryCorrect(cat.key, pred, result);
          const isPartial = checkCategoryPartial(cat.key, pred, result);
          if (isCorrect) {
            cssClass = 'result-correct';
            icon = ' \u2705';
          } else if (isPartial) {
            cssClass = 'result-partial';
            icon = ' \ud83d\udfe1';
          } else {
            cssClass = 'result-wrong';
            icon = ' \u274c';
          }
        }
      }

      html += `<td class="${cssClass}">${value}${icon}</td>`;
    }

    if (result) {
      let resultValue = '-';
      if (cat.key === 'podium-2') resultValue = result.podium?.[1] ? driverLastName(season, result.podium[1]) : '-';
      else if (cat.key === 'podium-3') resultValue = result.podium?.[2] ? driverLastName(season, result.podium[2]) : '-';
      else if (cat.key === 'bestConstructor') resultValue = result[cat.key] ? teamName(season, result[cat.key]) : '-';
      else resultValue = result[cat.key] ? driverLastName(season, result[cat.key]) : '-';
      html += `<td class="fw-bold">${resultValue}</td>`;
    }

    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function checkCategoryCorrect(key, pred, result) {
  if (key === 'winner') return pred.winner === result.winner;
  if (key === 'podium-2') return pred.podium?.[1] === result.podium?.[1];
  if (key === 'podium-3') return pred.podium?.[2] === result.podium?.[2];
  if (key === 'pole') return pred.pole === result.pole;
  if (key === 'fastestLap') return pred.fastestLap === result.fastestLap;
  if (key === 'bestConstructor') return pred.bestConstructor === result.bestConstructor;
  return false;
}

function checkCategoryPartial(key, pred, result) {
  // Partial: podium driver is on podium but wrong position
  if (key === 'podium-2' && pred.podium?.[1] && result.podium?.includes(pred.podium[1]) && pred.podium[1] !== result.podium[1]) return true;
  if (key === 'podium-3' && pred.podium?.[2] && result.podium?.includes(pred.podium[2]) && pred.podium[2] !== result.podium[2]) return true;
  return false;
}

function renderSprintPredictions(season, race, sprintPredictions, sprintResults) {
  const container = document.getElementById('sprint-predictions');
  if (!container) return;

  // Show the hidden section wrapper
  const section = document.getElementById('sprint-predictions-section');
  if (section) section.style.display = '';

  const roundStr = String(race.round);
  const result = sprintResults.sprintResults?.[roundStr] || null;
  const players = season.players;
  const roundPreds = sprintPredictions.sprintPredictions?.[roundStr] || {};

  if (Object.keys(roundPreds).length === 0) {
    container.innerHTML = `
      <h3 class="section-title">Sprint-Tipps</h3>
      <div class="empty-state">
        <div class="empty-state-icon">\ud83c\udfc3</div>
        <div class="empty-state-text">Noch keine Sprint-Tipps abgegeben</div>
      </div>
    `;
    return;
  }

  const categories = [
    { key: 'winner', label: 'Sprint-Sieger (= P1)', format: id => driverLastName(season, id) },
    { key: 'podium-2', label: 'Sprint P2', format: (_, pred) => pred?.podium?.[1] ? driverLastName(season, pred.podium[1]) : '-' },
    { key: 'podium-3', label: 'Sprint P3', format: (_, pred) => pred?.podium?.[2] ? driverLastName(season, pred.podium[2]) : '-' },
  ];

  let html = `<h3 class="section-title">Sprint-Tipps</h3>
    <table class="comparison-table">
    <thead><tr>
      <th>Kategorie</th>
      ${players.map(p => `<th data-player="${p.id}">${p.emoji} ${p.name}</th>`).join('')}
      ${result ? '<th>Ergebnis</th>' : ''}
    </tr></thead><tbody>`;

  for (const cat of categories) {
    html += '<tr>';
    html += `<td>${cat.label}</td>`;

    for (const player of players) {
      const pred = roundPreds[player.id];
      let value = '-';
      let cssClass = '';
      let icon = '';

      if (pred) {
        const late = isLate(pred.submittedAt, race.sprintStartUTC);

        if (cat.key.startsWith('podium-')) {
          value = cat.format(null, pred);
        } else {
          value = pred[cat.key] ? cat.format(pred[cat.key]) : '-';
        }

        if (late) {
          cssClass = 'result-wrong';
          icon = ' <span class="late-badge">Verspätet</span>';
        } else if (result) {
          const idx = cat.key === 'winner' ? 0 : parseInt(cat.key.split('-')[1]) - 1;
          const predVal = cat.key === 'winner' ? pred.winner : pred.podium?.[idx];
          const resVal = cat.key === 'winner' ? result.winner : result.podium?.[idx];
          if (predVal === resVal) {
            cssClass = 'result-correct';
            icon = ' \u2705';
          } else if (predVal && result.podium?.includes(predVal)) {
            cssClass = 'result-partial';
            icon = ' \ud83d\udfe1';
          } else {
            cssClass = 'result-wrong';
            icon = ' \u274c';
          }
        }
      }

      html += `<td class="${cssClass}">${value}${icon}</td>`;
    }

    if (result) {
      let resDriver = '-';
      if (cat.key === 'winner') resDriver = result.winner ? driverLastName(season, result.winner) : '-';
      else if (cat.key === 'podium-2') resDriver = result.podium?.[1] ? driverLastName(season, result.podium[1]) : '-';
      else if (cat.key === 'podium-3') resDriver = result.podium?.[2] ? driverLastName(season, result.podium[2]) : '-';
      html += `<td class="fw-bold">${resDriver}</td>`;
    }

    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderRaceResult(season, race, results) {
  const container = document.getElementById('race-result');
  if (!container) return;

  const roundStr = String(race.round);
  const result = results.results?.[roundStr];

  if (!result) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h3 class="section-title">Rennergebnis</h3>
    <div class="result-card">
      <div class="podium">
        <div class="podium-position p2">
          <div class="podium-label">\ud83e\udd48 P2</div>
          <div class="podium-driver">${driverName(season, result.podium[1])}</div>
        </div>
        <div class="podium-position p1">
          <div class="podium-label">\ud83e\udd47 P1</div>
          <div class="podium-driver">${driverName(season, result.podium[0])}</div>
        </div>
        <div class="podium-position p3">
          <div class="podium-label">\ud83e\udd49 P3</div>
          <div class="podium-driver">${driverName(season, result.podium[2])}</div>
        </div>
      </div>
      <div class="grid grid-3 mt-md" style="text-align: center; font-size: 0.9rem;">
        <div>
          <div class="text-muted">Pole Position</div>
          <div class="fw-bold">${driverName(season, result.pole)}</div>
        </div>
        <div>
          <div class="text-muted">Schnellste Runde</div>
          <div class="fw-bold">${driverName(season, result.fastestLap)}</div>
        </div>
        <div>
          <div class="text-muted">Bester Konstrukteur</div>
          <div class="fw-bold">${teamName(season, result.bestConstructor)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRacePointsBreakdown(season, race, predictions, results, sprintPredictions, sprintResults) {
  const container = document.getElementById('points-breakdown');
  if (!container) return;

  const roundStr = String(race.round);
  const result = results.results?.[roundStr];
  if (!result) {
    container.innerHTML = '';
    return;
  }

  const players = season.players;

  let html = '<h3 class="section-title">Punkte-Übersicht</h3><div class="points-breakdown">';

  for (const player of players) {
    const pred = predictions.predictions?.[roundStr]?.[player.id];
    const score = pred ? scoreRace(pred, result, race) : null;

    // Sprint
    let sprintScore = null;
    if (race.sprint) {
      const sprintResult = sprintResults.sprintResults?.[roundStr];
      const sprintPred = sprintPredictions.sprintPredictions?.[roundStr]?.[player.id];
      if (sprintResult && sprintPred) {
        sprintScore = scoreSprint(sprintPred, sprintResult, race);
      }
    }

    const totalRace = score ? score.total : 0;
    const totalSprint = sprintScore ? sprintScore.total : 0;
    const grandTotal = totalRace + totalSprint;
    const hasPerfect = score?.isPerfect;

    html += `
      <div class="points-breakdown-player card ${hasPerfect ? 'perfect-round' : ''}" data-player="${player.id}">
        <div class="card-header">
          <span class="card-title">${player.emoji} ${player.name}</span>
          ${hasPerfect ? '<span class="perfect-badge">\u2b50 Perfekte Runde!</span>' : ''}
          ${score?.late ? '<span class="late-badge">Verspätet</span>' : ''}
        </div>
        ${score && !score.late ? `
        <div class="points-row"><span>Rennsieger (= P1)</span><span class="points-value ${score.breakdown.winner > 0 ? 'positive' : 'zero'}">${score.breakdown.winner}</span></div>
        <div class="points-row"><span>Podium P2</span><span class="points-value ${score.breakdown.podiumP2 > 0 ? 'positive' : 'zero'}">${score.breakdown.podiumP2}</span></div>
        <div class="points-row"><span>Podium P3</span><span class="points-value ${score.breakdown.podiumP3 > 0 ? 'positive' : 'zero'}">${score.breakdown.podiumP3}</span></div>
        <div class="points-row"><span>Podium-Bonus</span><span class="points-value ${score.breakdown.podiumBonus > 0 ? 'positive' : 'zero'}">${score.breakdown.podiumBonus}</span></div>
        <div class="points-row"><span>Pole Position</span><span class="points-value ${score.breakdown.pole > 0 ? 'positive' : 'zero'}">${score.breakdown.pole}</span></div>
        <div class="points-row"><span>Schnellste Runde</span><span class="points-value ${score.breakdown.fastestLap > 0 ? 'positive' : 'zero'}">${score.breakdown.fastestLap}</span></div>
        <div class="points-row"><span>Bester Konstrukteur</span><span class="points-value ${score.breakdown.bestConstructor > 0 ? 'positive' : 'zero'}">${score.breakdown.bestConstructor}</span></div>
        <div class="points-row"><span>Perfekte Runde</span><span class="points-value ${score.breakdown.perfectRound > 0 ? 'positive' : 'zero'}">${score.breakdown.perfectRound}</span></div>
        <div class="points-row fw-bold"><span>Rennen gesamt</span><span>${totalRace}</span></div>
        ` : '<div class="points-row text-muted"><span>Kein Tipp / Verspätet</span><span>0</span></div>'}

        ${sprintScore && !sprintScore.late ? `
        <div class="points-row mt-md"><span>Sprint-Sieger</span><span class="points-value ${sprintScore.breakdown.sprintWinner > 0 ? 'positive' : 'zero'}">${sprintScore.breakdown.sprintWinner}</span></div>
        <div class="points-row"><span>Sprint P2</span><span class="points-value ${sprintScore.breakdown.sprintP2 > 0 ? 'positive' : 'zero'}">${sprintScore.breakdown.sprintP2}</span></div>
        <div class="points-row"><span>Sprint P3</span><span class="points-value ${sprintScore.breakdown.sprintP3 > 0 ? 'positive' : 'zero'}">${sprintScore.breakdown.sprintP3}</span></div>
        <div class="points-row"><span>Sprint Podium-Bonus</span><span class="points-value ${sprintScore.breakdown.sprintPodiumBonus > 0 ? 'positive' : 'zero'}">${sprintScore.breakdown.sprintPodiumBonus}</span></div>
        <div class="points-row"><span>Perfekter Sprint</span><span class="points-value ${sprintScore.breakdown.perfectSprint > 0 ? 'positive' : 'zero'}">${sprintScore.breakdown.perfectSprint}</span></div>
        <div class="points-row fw-bold"><span>Sprint gesamt</span><span>${totalSprint}</span></div>
        ` : ''}

        <div class="points-total">Gesamt: ${grandTotal} Punkte</div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ---- Tip Forms (rennen.html) ----

function tipLabel(text, tooltip) {
  return `${text} <span class="tip-info">i<span class="tip-tooltip">${tooltip}</span></span>`;
}

// Tooltip texts for each tip category
const TIP_HINTS = {
  winner: '3 Punkte für den richtigen Rennsieger (= Podium P1).',
  podium1: '2 Punkte bei richtiger Position. 1 Punkt wenn der Fahrer auf dem Podium landet, aber auf einer anderen Position.',
  podium2: '2 Punkte bei richtiger Position. 1 Punkt wenn der Fahrer auf dem Podium landet, aber auf einer anderen Position.',
  pole: '3 Punkte wenn du den Pole-Sitter richtig tippst. Das ist der Fahrer, der im Qualifying die schnellste Runde fährt.',
  fastestLap: '3 Punkte wenn du tippst, wer die schnellste Runde im Rennen fährt.',
  bestConstructor: '3 Punkte wenn du tippst, welches Team die meisten Punkte in diesem Rennen holt.',
  sprintWinner: '3 Punkte für den richtigen Sprint-Sieger. Zählt automatisch auch als Sprint P1.',
  sprintP1: '1 Punkt bei richtiger Position. 1 Punkt Bonus wenn auf dem Podium aber falsche Position.',
  sprintP2: '1 Punkt bei richtiger Position. 1 Punkt Bonus wenn auf dem Podium aber falsche Position.',
  wdc: '20 Punkte am Saisonende, wenn du den Fahrer-Weltmeister richtig tippst. Muss vor Runde 1 abgegeben werden.',
  wcc: '15 Punkte am Saisonende, wenn du das Konstrukteurs-WM-Team richtig tippst. Muss vor Runde 1 abgegeben werden.',
};

function driverSelectOptions(season, selected) {
  return `<option value="">– Fahrer wählen –</option>` +
    season.drivers.map(d =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.name} (#${d.number})</option>`
    ).join('');
}

function teamSelectOptions(season, selected) {
  return `<option value="">– Team wählen –</option>` +
    season.teams.map(t =>
      `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.name}</option>`
    ).join('');
}

// ---- Searchable Dropdown Component ----

let searchSelectCounter = 0;

function getTeamForDriver(season, driverId) {
  const driver = season.drivers.find(d => d.id === driverId);
  if (!driver) return null;
  return season.teams.find(t => t.id === driver.team) || null;
}

function driverSearchSelect(season, name, selected, required = false, group = '') {
  const id = `ss-${name}-${++searchSelectCounter}`;
  const selDriver = season.drivers.find(d => d.id === selected);
  const selTeam = selDriver ? getTeamForDriver(season, selDriver.id) : null;

  const displayHtml = selDriver
    ? `<span class="ss-selected-display">
        <span class="ss-selected-color" style="background:${selTeam?.color || '#666'}"></span>
        <span class="ss-selected-number">#${selDriver.number}</span>
        ${selDriver.name}
      </span>`
    : '<span class="ss-placeholder">– Fahrer wählen –</span>';

  const optionsHtml = season.drivers.map(d => {
    const team = getTeamForDriver(season, d.id);
    return `<div class="ss-option ${d.id === selected ? 'selected' : ''}" data-value="${d.id}" data-search="${d.name.toLowerCase()} ${d.number} ${team?.name.toLowerCase() || ''}">
      <span class="ss-option-color" style="background:${team?.color || '#666'}"></span>
      <span class="ss-option-number">#${d.number}</span>
      <span class="ss-option-name">${d.name}</span>
      <span class="ss-option-team">${team?.name || ''}</span>
    </div>`;
  }).join('');

  return `<div class="search-select" id="${id}" data-name="${name}" data-value="${selected || ''}" ${required ? 'data-required="true"' : ''} ${group ? `data-group="${group}"` : ''}>
    <div class="search-select-trigger">${displayHtml}<span class="ss-arrow">▼</span></div>
    <div class="search-select-dropdown">
      <div class="ss-search"><input type="text" placeholder="Suchen..." autocomplete="off"></div>
      <div class="ss-options">${optionsHtml}</div>
    </div>
  </div>`;
}

function teamSearchSelect(season, name, selected, required = false) {
  const id = `ss-${name}-${++searchSelectCounter}`;
  const selTeam = season.teams.find(t => t.id === selected);

  const displayHtml = selTeam
    ? `<span class="ss-selected-display">
        <span class="ss-selected-color" style="background:${selTeam.color}"></span>
        ${selTeam.name}
      </span>`
    : '<span class="ss-placeholder">– Team wählen –</span>';

  const optionsHtml = season.teams.map(t => {
    return `<div class="ss-option ${t.id === selected ? 'selected' : ''}" data-value="${t.id}" data-search="${t.name.toLowerCase()} ${t.drivers.join(' ')}">
      <span class="ss-option-color" style="background:${t.color}"></span>
      <span class="ss-option-name">${t.name}</span>
    </div>`;
  }).join('');

  return `<div class="search-select" id="${id}" data-name="${name}" data-value="${selected || ''}" ${required ? 'data-required="true"' : ''}>
    <div class="search-select-trigger">${displayHtml}<span class="ss-arrow">▼</span></div>
    <div class="search-select-dropdown">
      <div class="ss-search"><input type="text" placeholder="Suchen..." autocomplete="off"></div>
      <div class="ss-options">${optionsHtml}</div>
    </div>
  </div>`;
}

/**
 * Initialize all search-select dropdowns within a container.
 */
function initSearchSelects(container) {
  // Group exclusion: hide options already selected in sibling dropdowns
  function updateGroupExclusions() {
    const groups = {};
    container.querySelectorAll('.search-select[data-group]').forEach(ss => {
      const g = ss.dataset.group;
      if (!g) return;
      if (!groups[g]) groups[g] = [];
      groups[g].push(ss);
    });
    for (const selects of Object.values(groups)) {
      const taken = new Set();
      selects.forEach(ss => { if (ss.dataset.value) taken.add(ss.dataset.value); });
      selects.forEach(ss => {
        const own = ss.dataset.value;
        ss.querySelectorAll('.ss-option').forEach(opt => {
          const isTaken = taken.has(opt.dataset.value) && opt.dataset.value !== own;
          opt.classList.toggle('ss-excluded', isTaken);
        });
      });
    }
  }

  container.querySelectorAll('.search-select').forEach(ss => {
    const trigger = ss.querySelector('.search-select-trigger');
    const dropdown = ss.querySelector('.search-select-dropdown');
    const searchInput = ss.querySelector('.ss-search input');
    const optionsContainer = ss.querySelector('.ss-options');
    const allOptions = ss.querySelectorAll('.ss-option');

    function open() {
      // Close all other open dropdowns
      document.querySelectorAll('.search-select.open').forEach(other => {
        if (other !== ss) close(other);
      });
      ss.classList.add('open');
      trigger.classList.add('open');
      searchInput.value = '';
      updateGroupExclusions();
      filterOptions('');
      setTimeout(() => searchInput.focus(), 10);
    }

    function close(el) {
      el = el || ss;
      el.classList.remove('open');
      el.querySelector('.search-select-trigger').classList.remove('open');
    }

    function filterOptions(query) {
      const q = query.toLowerCase();
      let visible = 0;
      allOptions.forEach(opt => {
        const excluded = opt.classList.contains('ss-excluded');
        const match = !excluded && (!q || opt.dataset.search.includes(q));
        opt.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      // Show/hide no results
      let noRes = optionsContainer.querySelector('.ss-no-results');
      if (visible === 0) {
        if (!noRes) {
          noRes = document.createElement('div');
          noRes.className = 'ss-no-results';
          noRes.textContent = 'Kein Ergebnis';
          optionsContainer.appendChild(noRes);
        }
        noRes.style.display = '';
      } else if (noRes) {
        noRes.style.display = 'none';
      }
    }

    function selectOption(opt) {
      const value = opt.dataset.value;
      ss.dataset.value = value;

      // Update display
      const displayParts = [];
      const colorEl = opt.querySelector('.ss-option-color');
      if (colorEl) displayParts.push(`<span class="ss-selected-color" style="background:${colorEl.style.background}"></span>`);
      const numEl = opt.querySelector('.ss-option-number');
      if (numEl) displayParts.push(`<span class="ss-selected-number">${numEl.textContent}</span>`);
      const nameEl = opt.querySelector('.ss-option-name');
      displayParts.push(nameEl.textContent);

      trigger.innerHTML = `<span class="ss-selected-display">${displayParts.join(' ')}</span><span class="ss-arrow">▼</span>`;

      // Update selected state
      allOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      close();
      updateGroupExclusions();
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ss.classList.contains('open')) close();
      else open();
    });

    searchInput.addEventListener('input', () => filterOptions(searchInput.value));
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    allOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(opt);
      });
    });
  });

  // Initial exclusion update (for pre-filled values)
  updateGroupExclusions();

  // Close on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.search-select.open').forEach(ss => {
      ss.classList.remove('open');
      ss.querySelector('.search-select-trigger').classList.remove('open');
    });
  });
}

/**
 * Collect values from search-selects as if they were form fields.
 */
function getSearchSelectValues(container) {
  const values = {};
  container.querySelectorAll('.search-select').forEach(ss => {
    values[ss.dataset.name] = ss.dataset.value || '';
  });
  return values;
}

function renderTipForm(season, race, predictions, results, data) {
  const container = document.getElementById('tip-form-section');
  if (!container) return;

  const status = getDeadlineStatus(race, results);
  if (status !== 'open') {
    container.innerHTML = '';
    return;
  }

  if (!isLoggedIn()) {
    container.innerHTML = `
      <div class="card tip-login-prompt">
        <div class="text-center">
          <p>Wähle deinen Namen, um deinen Tipp abzugeben</p>
          <button class="btn btn-primary" onclick="window.__showLoginModal()">Name wählen</button>
        </div>
      </div>
    `;
    return;
  }

  const playerId = getPlayerIdFromSession();
  if (!playerId) {
    container.innerHTML = '';
    return;
  }

  const player = getPlayer(season, playerId);
  const roundStr = String(race.round);
  const existing = predictions.predictions?.[roundStr]?.[playerId];

  container.innerHTML = `
    <h2 class="section-title">Dein Tipp</h2>
    <div class="card tip-form-card" ${player ? `style="border-left: 4px solid ${player.color}"` : ''}>
      <div class="tip-form-header">
        <span>${player ? `${player.emoji} ${player.name}` : playerId}</span>
        ${existing ? '<span class="status-badge status-open">Tipp vorhanden – wird überschrieben</span>' : ''}
      </div>
      <div id="race-tip-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">${tipLabel('Rennsieger (= P1)', TIP_HINTS.winner)}</label>
          ${driverSearchSelect(season, 'winner', existing?.winner, true, 'podium')}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Podium P2', TIP_HINTS.podium1)}</label>
          ${driverSearchSelect(season, 'podium_1', existing?.podium?.[1], true, 'podium')}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Podium P3', TIP_HINTS.podium2)}</label>
          ${driverSearchSelect(season, 'podium_2', existing?.podium?.[2], true, 'podium')}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Pole Position', TIP_HINTS.pole)}</label>
          ${driverSearchSelect(season, 'pole', existing?.pole)}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Schnellste Runde', TIP_HINTS.fastestLap)}</label>
          ${driverSearchSelect(season, 'fastestLap', existing?.fastestLap)}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Bester Konstrukteur', TIP_HINTS.bestConstructor)}</label>
          ${teamSearchSelect(season, 'bestConstructor', existing?.bestConstructor)}
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="race-tip-submit">Tipp abgeben</button>
        </div>
      </div>
    </div>
  `;

  const formEl = container.querySelector('#race-tip-form');
  initSearchSelects(formEl);

  container.querySelector('#race-tip-submit').addEventListener('click', async () => {
    const vals = getSearchSelectValues(formEl);
    const submitBtn = container.querySelector('#race-tip-submit');

    if (!vals.winner) {
      showTipToast('Bitte Rennsieger wählen', 'error');
      return;
    }

    // Winner = P1 auto-sync
    const podium = [vals.winner, vals.podium_1, vals.podium_2];

    // Duplicate validation for podium
    const podiumSet = podium.filter(Boolean);
    if (new Set(podiumSet).size !== podiumSet.length) {
      showTipToast('Podium: Jeder Fahrer darf nur einmal vorkommen!', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitRacePrediction(race.round, playerId, {
        winner: vals.winner,
        podium,
        pole: vals.pole || '',
        fastestLap: vals.fastestLap || '',
        bestConstructor: vals.bestConstructor || '',
      });
      showTipToast('Tipp gespeichert!');
      const newData = await import('./utils.js').then(m => m.loadAllData());
      renderRacePredictions(season, race, newData.predictions, newData.results);
      submitBtn.textContent = 'Tipp aktualisieren';
      submitBtn.disabled = false;
    } catch (err) {
      showTipToast(err.message || 'Fehler beim Speichern', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tipp abgeben';
    }
  });
}

function renderSprintTipForm(season, race, sprintPredictions, sprintResults, data) {
  const container = document.getElementById('sprint-tip-form-section');
  if (!container) return;

  const status = getSprintDeadlineStatus(race, sprintResults);
  if (status !== 'open') {
    container.innerHTML = '';
    return;
  }

  if (!isLoggedIn()) {
    container.innerHTML = `
      <div class="card tip-login-prompt">
        <div class="text-center">
          <p>Wähle deinen Namen, um deinen Sprint-Tipp abzugeben</p>
          <button class="btn btn-primary" onclick="window.__showLoginModal()">Name wählen</button>
        </div>
      </div>
    `;
    return;
  }

  const playerId = getPlayerIdFromSession();
  if (!playerId) { container.innerHTML = ''; return; }

  const player = getPlayer(season, playerId);
  const roundStr = String(race.round);
  const existing = sprintPredictions.sprintPredictions?.[roundStr]?.[playerId];

  container.innerHTML = `
    <h2 class="section-title">Dein Sprint-Tipp</h2>
    <div class="card tip-form-card" ${player ? `style="border-left: 4px solid ${player.color}"` : ''}>
      <div class="tip-form-header">
        <span>${player ? `${player.emoji} ${player.name}` : playerId} <span class="sprint-badge">Sprint</span></span>
        ${existing ? '<span class="status-badge status-open">Tipp vorhanden</span>' : ''}
      </div>
      <div id="sprint-tip-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">${tipLabel('Sprint-Sieger (= P1)', TIP_HINTS.sprintWinner)}</label>
          ${driverSearchSelect(season, 'winner', existing?.winner, true, 'sprint-podium')}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Sprint P2', TIP_HINTS.sprintP1)}</label>
          ${driverSearchSelect(season, 'podium_1', existing?.podium?.[1], true, 'sprint-podium')}
        </div>
        <div class="form-group">
          <label class="form-label">${tipLabel('Sprint P3', TIP_HINTS.sprintP2)}</label>
          ${driverSearchSelect(season, 'podium_2', existing?.podium?.[2], true, 'sprint-podium')}
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="sprint-tip-submit">Sprint-Tipp abgeben</button>
        </div>
      </div>
    </div>
  `;

  const sprintFormEl = container.querySelector('#sprint-tip-form');
  initSearchSelects(sprintFormEl);

  container.querySelector('#sprint-tip-submit').addEventListener('click', async () => {
    const vals = getSearchSelectValues(sprintFormEl);
    const submitBtn = container.querySelector('#sprint-tip-submit');

    if (!vals.winner) {
      showTipToast('Bitte Sprint-Sieger wählen', 'error');
      return;
    }

    // Winner = P1 auto-sync
    const podium = [vals.winner, vals.podium_1, vals.podium_2];

    // Duplicate validation for podium
    const podiumSet = podium.filter(Boolean);
    if (new Set(podiumSet).size !== podiumSet.length) {
      showTipToast('Podium: Jeder Fahrer darf nur einmal vorkommen!', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitSprintPrediction(race.round, playerId, {
        winner: vals.winner,
        podium,
      });
      showTipToast('Sprint-Tipp gespeichert!');
      submitBtn.textContent = 'Sprint-Tipp aktualisieren';
      submitBtn.disabled = false;
    } catch (err) {
      showTipToast(err.message || 'Fehler beim Speichern', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sprint-Tipp abgeben';
    }
  });
}

function showTipToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
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

// ---- Season Tips (saison.html) ----

export function renderSeasonPage(data) {
  const { season, predictions, sprintPredictions, seasonPredictions, results, sprintResults } = data;
  const container = document.getElementById('season-content');
  if (!container) return;

  const nextRace = getNextRace(season, results);
  const preds = seasonPredictions.seasonPredictions || {};
  const round1 = getRace(season, 1);
  const now = new Date();
  const seasonLocked = round1 && now >= new Date(round1.raceStartUTC);

  let html = `
    <div class="race-header">
      <h1>Tipps 2026</h1>
      <div class="race-info">Renn-, Sprint- & Saison-Tipps abgeben</div>
    </div>
  `;

  // Next race tip form
  if (nextRace) {
    html += `
      <section class="section">
        <h2 class="section-title">${countryFlag(nextRace.countryCode)} Runde ${nextRace.round} – ${nextRace.name}</h2>
        <div id="tip-form-section"></div>
      </section>
    `;
    if (nextRace.sprint) {
      html += `
        <section class="section">
          <div id="sprint-tip-form-section"></div>
        </section>
      `;
    }
  }

  // Season tip form
  html += `
    <section class="section">
      <h2 class="section-title">Saison-Tipps (WDC & WCC)
        ${seasonLocked ? '<span class="status-badge status-locked" style="margin-left: var(--space-sm); font-size: 0.7rem;">Gesperrt</span>' : '<span class="status-badge status-open" style="margin-left: var(--space-sm); font-size: 0.7rem;">Offen</span>'}
      </h2>
      <div id="season-tip-form"></div>
    </section>
  `;

  // Season tips display
  html += '<section class="section">';
  if (Object.keys(preds).length === 0) {
    html += `<div class="empty-state"><div class="empty-state-icon">\ud83c\udfaf</div><div class="empty-state-text">Noch keine Saison-Tipps abgegeben</div></div>`;
  } else {
    if (!seasonLocked) {
      html += '<div class="text-muted mb-md" style="font-size: var(--font-sm);">Saison-Tipps werden nach Start von Runde 1 aufgedeckt</div>';
    }
    html += '<div class="season-tip-grid">';
    for (const player of season.players) {
      const pred = preds[player.id];
      if (!pred) {
        html += `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name" style="justify-content: center">${player.emoji} ${player.name}</div>
            <div class="text-muted mt-md">Kein Tipp</div>
          </div>
        `;
      } else if (!seasonLocked) {
        html += `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name" style="justify-content: center">${player.emoji} ${player.name}</div>
            <div class="mt-lg">
              <div class="season-tip-label">Weltmeister (WDC)</div>
              <div class="season-tip-value masked-tip">Abgegeben</div>
            </div>
            <div class="mt-md">
              <div class="season-tip-label">Konstrukteurs-WM (WCC)</div>
              <div class="season-tip-value masked-tip">Abgegeben</div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name" style="justify-content: center">${player.emoji} ${player.name}</div>
            <div class="mt-lg">
              <div class="season-tip-label">Weltmeister (WDC)</div>
              <div class="season-tip-value" style="color: ${teamColorForDriver(season, pred.wdc)}">
                ${driverName(season, pred.wdc)}
              </div>
            </div>
            <div class="mt-md">
              <div class="season-tip-label">Konstrukteurs-WM (WCC)</div>
              <div class="season-tip-value">${teamName(season, pred.wcc)}</div>
            </div>
          </div>
        `;
      }
    }
    html += '</div>';
  }
  html += '</section>';

  // Race calendar
  html += `
    <section class="section">
      <h2 class="section-title">Rennkalender 2026</h2>
      <div id="calendar" class="calendar-grid"></div>
    </section>
  `;

  container.innerHTML = html;

  // Render tip forms into the containers
  if (nextRace) {
    renderTipForm(season, nextRace, predictions, results, data);
    if (nextRace.sprint) {
      renderSprintTipForm(season, nextRace, sprintPredictions, sprintResults, data);
    }
  }
  if (!seasonLocked) {
    renderSeasonTipForm(season, seasonPredictions);
  }
  renderCalendar(season, results);
}

function renderSeasonTipForm(season, seasonPredictions) {
  const container = document.getElementById('season-tip-form');
  if (!container) return;

  if (!isLoggedIn()) {
    container.innerHTML = `
      <div class="section">
        <div class="card tip-login-prompt">
          <div class="text-center">
            <p>Wähle deinen Namen, um deinen Saison-Tipp abzugeben</p>
            <button class="btn btn-primary" onclick="window.__showLoginModal()">Name wählen</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const playerId = getPlayerIdFromSession();
  if (!playerId) { container.innerHTML = ''; return; }

  const player = getPlayer(season, playerId);
  const existing = seasonPredictions.seasonPredictions?.[playerId];

  container.innerHTML = `
    <div class="section">
      <h2 class="section-title">Dein Saison-Tipp</h2>
      <div class="card tip-form-card" ${player ? `style="border-left: 4px solid ${player.color}"` : ''}>
        <div class="tip-form-header">
          <span>${player ? `${player.emoji} ${player.name}` : playerId}</span>
          ${existing ? '<span class="status-badge status-open">Tipp vorhanden – wird überschrieben</span>' : ''}
        </div>
        <div id="season-tip-form-inner" class="admin-form-grid">
          <div class="form-group">
            <label class="form-label">${tipLabel('Weltmeister (WDC)', TIP_HINTS.wdc)}</label>
            ${driverSearchSelect(season, 'wdc', existing?.wdc, true)}
          </div>
          <div class="form-group">
            <label class="form-label">${tipLabel('Konstrukteurs-WM (WCC)', TIP_HINTS.wcc)}</label>
            ${teamSearchSelect(season, 'wcc', existing?.wcc, true)}
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" id="season-tip-submit">Saison-Tipp abgeben</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const seasonFormEl = container.querySelector('#season-tip-form-inner');
  initSearchSelects(seasonFormEl);

  container.querySelector('#season-tip-submit').addEventListener('click', async () => {
    const vals = getSearchSelectValues(seasonFormEl);
    const submitBtn = container.querySelector('#season-tip-submit');

    if (!vals.wdc || !vals.wcc) {
      showTipToast('Bitte WDC und WCC wählen', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitSeasonPrediction(playerId, { wdc: vals.wdc, wcc: vals.wcc });
      showTipToast('Saison-Tipp gespeichert!');
      submitBtn.textContent = 'Saison-Tipp aktualisieren';
      submitBtn.disabled = false;
    } catch (err) {
      showTipToast(err.message || 'Fehler beim Speichern', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Saison-Tipp abgeben';
    }
  });
}

// ---- Rules Page (regeln.html) ----

export function renderRulesPage() {
  // Static content – rendered directly in HTML
}
