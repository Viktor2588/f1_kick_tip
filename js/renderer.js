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

// ---- Dashboard (index.html) ----

export function renderDashboard(data) {
  const { season, predictions, sprintPredictions, seasonPredictions, results, sprintResults } = data;
  const standings = calculateStandings(
    season, predictions, sprintPredictions, results, sprintResults, seasonPredictions, null
  );

  renderLeaderboard(season, standings);
  renderSeasonProgress(season, results);
  renderCountdown(season, results);
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

function renderSeasonProgress(season, results) {
  const container = document.getElementById('season-progress');
  if (!container) return;

  const total = season.races.length;
  const completed = completedRaceCount(results);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  container.innerHTML = `
    <div class="flex-between mb-md">
      <span class="text-secondary">Saison-Fortschritt</span>
      <span class="fw-bold">${completed} / ${total} Rennen</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${pct}%"></div>
    </div>
  `;
}

function renderCountdown(season, results) {
  const container = document.getElementById('countdown');
  if (!container) return;

  const next = getNextRace(season, results);
  if (!next) {
    container.innerHTML = `
      <div class="countdown">
        <div class="countdown-label">Saison 2026 abgeschlossen!</div>
      </div>
    `;
    return;
  }

  function update() {
    const cd = countdown(next.raceStartUTC);
    container.innerHTML = `
      <div class="countdown">
        <div class="countdown-label">
          Nächstes Rennen: ${countryFlag(next.countryCode)} <strong>${next.name}</strong>
          ${next.sprint ? '<span class="sprint-badge">Sprint</span>' : ''}
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
        ${cd.expired ? '<div class="mt-md text-secondary">Tipp-Deadline abgelaufen!</div>' : ''}
      </div>
    `;
  }

  update();
  setInterval(update, 1000);
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

  // Check if round 1 deadline has passed (only show after that)
  const round1 = getRace(season, 1);
  const now = new Date();
  if (round1 && now < new Date(round1.raceStartUTC)) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\ud83d\udd12</div>
        <div class="empty-state-text">Saison-Tipps werden nach Start von Runde 1 sichtbar</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="season-tip-grid">
      ${season.players.map(player => {
        const pred = preds[player.id];
        if (!pred) return `
          <div class="card season-tip-card" data-player="${player.id}">
            <div class="player-name">${player.emoji} ${player.name}</div>
            <div class="text-muted mt-md">Kein Tipp abgegeben</div>
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
      <div class="race-status">
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
    </div>
  `;
}

function renderRaceCountdown(race, results) {
  const container = document.getElementById('race-countdown');
  if (!container) return;

  const status = getDeadlineStatus(race, results);
  if (status !== 'open') {
    container.innerHTML = '';
    return;
  }

  function update() {
    const cd = countdown(race.raceStartUTC);
    if (cd.expired) {
      container.innerHTML = '<div class="text-center text-secondary">Tipp-Deadline abgelaufen</div>';
      return;
    }
    container.innerHTML = `
      <div class="countdown">
        <div class="countdown-label">Deadline: Rennstart</div>
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
    { key: 'winner', label: 'Rennsieger', format: id => driverLastName(season, id) },
    { key: 'podium-1', label: 'Podium P1', format: (_, pred) => pred?.podium?.[0] ? driverLastName(season, pred.podium[0]) : '-' },
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

        if (cat.key === 'podium-1' || cat.key === 'podium-2' || cat.key === 'podium-3') {
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
      if (cat.key === 'podium-1') resultValue = result.podium?.[0] ? driverLastName(season, result.podium[0]) : '-';
      else if (cat.key === 'podium-2') resultValue = result.podium?.[1] ? driverLastName(season, result.podium[1]) : '-';
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
  if (key === 'podium-1') return pred.podium?.[0] === result.podium?.[0];
  if (key === 'podium-2') return pred.podium?.[1] === result.podium?.[1];
  if (key === 'podium-3') return pred.podium?.[2] === result.podium?.[2];
  if (key === 'pole') return pred.pole === result.pole;
  if (key === 'fastestLap') return pred.fastestLap === result.fastestLap;
  if (key === 'bestConstructor') return pred.bestConstructor === result.bestConstructor;
  return false;
}

function checkCategoryPartial(key, pred, result) {
  // Partial: podium driver is on podium but wrong position
  if (key === 'podium-1' && pred.podium?.[0] && result.podium?.includes(pred.podium[0]) && pred.podium[0] !== result.podium[0]) return true;
  if (key === 'podium-2' && pred.podium?.[1] && result.podium?.includes(pred.podium[1]) && pred.podium[1] !== result.podium[1]) return true;
  if (key === 'podium-3' && pred.podium?.[2] && result.podium?.includes(pred.podium[2]) && pred.podium[2] !== result.podium[2]) return true;
  return false;
}

function renderSprintPredictions(season, race, sprintPredictions, sprintResults) {
  const container = document.getElementById('sprint-predictions');
  if (!container) return;

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
    { key: 'winner', label: 'Sprint-Sieger', format: id => driverLastName(season, id) },
    { key: 'podium-1', label: 'Sprint P1', format: (_, pred) => pred?.podium?.[0] ? driverLastName(season, pred.podium[0]) : '-' },
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
      const idx = categories.indexOf(cat);
      const resDriver = result.podium?.[idx] ? driverLastName(season, result.podium[idx]) : '-';
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
        <div class="points-row"><span>Rennsieger</span><span class="points-value ${score.breakdown.winner > 0 ? 'positive' : 'zero'}">${score.breakdown.winner}</span></div>
        <div class="points-row"><span>Podium P1</span><span class="points-value ${score.breakdown.podiumP1 > 0 ? 'positive' : 'zero'}">${score.breakdown.podiumP1}</span></div>
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
      <form id="race-tip-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">Rennsieger</label>
          <select class="form-select" name="winner" required>
            ${driverSelectOptions(season, existing?.winner)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Podium P1</label>
          <select class="form-select" name="podium_0" required>
            ${driverSelectOptions(season, existing?.podium?.[0])}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Podium P2</label>
          <select class="form-select" name="podium_1" required>
            ${driverSelectOptions(season, existing?.podium?.[1])}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Podium P3</label>
          <select class="form-select" name="podium_2" required>
            ${driverSelectOptions(season, existing?.podium?.[2])}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Pole Position</label>
          <select class="form-select" name="pole">
            ${driverSelectOptions(season, existing?.pole)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Schnellste Runde</label>
          <select class="form-select" name="fastestLap">
            ${driverSelectOptions(season, existing?.fastestLap)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Bester Konstrukteur</label>
          <select class="form-select" name="bestConstructor">
            ${teamSelectOptions(season, existing?.bestConstructor)}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Tipp abgeben</button>
        </div>
      </form>
    </div>
  `;

  container.querySelector('#race-tip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const submitBtn = form.querySelector('[type="submit"]');

    const winner = fd.get('winner');
    if (!winner) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitRacePrediction(race.round, playerId, {
        winner,
        podium: [fd.get('podium_0'), fd.get('podium_1'), fd.get('podium_2')],
        pole: fd.get('pole') || '',
        fastestLap: fd.get('fastestLap') || '',
        bestConstructor: fd.get('bestConstructor') || '',
      });
      showTipToast('Tipp gespeichert!');
      // Reload data to update predictions table
      const newData = await import('./utils.js').then(m => m.loadAllData());
      renderRacePredictions(season, race, newData.predictions, newData.results);
      // Update the form to show "already submitted" badge
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
      <form id="sprint-tip-form" class="admin-form-grid">
        <div class="form-group">
          <label class="form-label">Sprint-Sieger</label>
          <select class="form-select" name="winner" required>
            ${driverSelectOptions(season, existing?.winner)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sprint P1</label>
          <select class="form-select" name="podium_0" required>
            ${driverSelectOptions(season, existing?.podium?.[0])}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sprint P2</label>
          <select class="form-select" name="podium_1" required>
            ${driverSelectOptions(season, existing?.podium?.[1])}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sprint P3</label>
          <select class="form-select" name="podium_2" required>
            ${driverSelectOptions(season, existing?.podium?.[2])}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Sprint-Tipp abgeben</button>
        </div>
      </form>
    </div>
  `;

  container.querySelector('#sprint-tip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const submitBtn = form.querySelector('[type="submit"]');

    const winner = fd.get('winner');
    if (!winner) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitSprintPrediction(race.round, playerId, {
        winner,
        podium: [fd.get('podium_0'), fd.get('podium_1'), fd.get('podium_2')],
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
  const { season, seasonPredictions, results } = data;
  const container = document.getElementById('season-content');
  if (!container) return;

  const preds = seasonPredictions.seasonPredictions || {};
  const round1 = getRace(season, 1);
  const now = new Date();
  const locked = round1 && now >= new Date(round1.raceStartUTC);

  let statusHtml;
  if (!locked) {
    statusHtml = '<span class="status-badge status-open">Offen \u2013 Tipps bis Runde 1 möglich</span>';
  } else {
    statusHtml = '<span class="status-badge status-locked">Gesperrt</span>';
  }

  let html = `
    <div class="race-header">
      <h1>Saison-Tipps 2026</h1>
      <div class="race-info">Weltmeister (WDC) & Konstrukteurs-WM (WCC)</div>
      <div class="race-status mt-md">${statusHtml}</div>
    </div>
  `;

  // Season tip form (only when open)
  html += '<div id="season-tip-form"></div>';

  if (!locked && Object.keys(preds).length > 0) {
    html += `<div class="empty-state"><div class="empty-state-text">\ud83d\udd12 Tipps werden nach Start von Runde 1 angezeigt</div></div>`;
  } else if (Object.keys(preds).length === 0 && locked) {
    html += `<div class="empty-state"><div class="empty-state-icon">\ud83c\udfaf</div><div class="empty-state-text">Noch keine Saison-Tipps abgegeben</div></div>`;
  } else if (locked) {
    html += '<div class="season-tip-grid">';
    for (const player of season.players) {
      const pred = preds[player.id];
      html += `
        <div class="card season-tip-card" data-player="${player.id}">
          <div class="player-name" style="justify-content: center">${player.emoji} ${player.name}</div>
          ${pred ? `
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
          ` : '<div class="text-muted mt-md">Kein Tipp</div>'}
        </div>
      `;
    }
    html += '</div>';
  }

  container.innerHTML = html;

  // Render the season tip form if deadline is open
  if (!locked) {
    renderSeasonTipForm(season, seasonPredictions);
  }
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
        <form id="season-tip-form-inner" class="admin-form-grid">
          <div class="form-group">
            <label class="form-label">Weltmeister (WDC)</label>
            <select class="form-select" name="wdc" required>
              ${driverSelectOptions(season, existing?.wdc)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Konstrukteurs-WM (WCC)</label>
            <select class="form-select" name="wcc" required>
              ${teamSelectOptions(season, existing?.wcc)}
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Saison-Tipp abgeben</button>
          </div>
        </form>
      </div>
    </div>
  `;

  container.querySelector('#season-tip-form-inner').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const submitBtn = form.querySelector('[type="submit"]');

    const wdc = fd.get('wdc');
    const wcc = fd.get('wcc');
    if (!wdc || !wcc) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
      await submitSeasonPrediction(playerId, { wdc, wcc });
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
