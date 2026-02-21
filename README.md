# F1 Kick Tip 2026

Tippspiel für die Formel-1-Saison 2026. Thomas, Julia und Viktor tippen vor jedem Rennen und vergleichen ihre Vorhersagen.

## Mitspielen

### Renntipps abgeben

1. Öffne `data/predictions.json`
2. Finde die aktuelle Runde (z.B. `"1"` für Runde 1)
3. Trage deinen Tipp ein (verwende die IDs aus `data/season.json`):

```json
{
  "predictions": {
    "1": {
      "thomas": {
        "winner": "verstappen",
        "podium": ["verstappen", "norris", "leclerc"],
        "pole": "verstappen",
        "fastestLap": "norris",
        "bestConstructor": "mclaren",
        "submittedAt": "2026-03-07T10:00:00Z"
      }
    }
  }
}
```

4. Committe und pushe **vor dem Rennstart**

### Sprint-Tipps (6 Runden)

Bei Sprint-Wochenenden zusätzlich `data/sprint-predictions.json` editieren:

```json
{
  "sprintPredictions": {
    "2": {
      "thomas": {
        "winner": "norris",
        "podium": ["norris", "verstappen", "piastri"],
        "submittedAt": "2026-03-14T08:00:00Z"
      }
    }
  }
}
```

Sprint-Tipps müssen **vor dem Sprint-Start** abgegeben werden.

### Saison-Tipps (einmalig vor Runde 1)

Editiere `data/season-predictions.json` **vor dem Start von Runde 1**:

```json
{
  "seasonPredictions": {
    "thomas": {
      "wdc": "verstappen",
      "wcc": "mclaren",
      "submittedAt": "2026-03-01T12:00:00Z"
    }
  }
}
```

## Ergebnisse eintragen

Nach dem Rennen trägt jemand die Ergebnisse in `data/results.json` ein:

```json
{
  "results": {
    "1": {
      "winner": "verstappen",
      "podium": ["verstappen", "norris", "hamilton"],
      "pole": "verstappen",
      "fastestLap": "norris",
      "bestConstructor": "mclaren",
      "enteredAt": "2026-03-08T07:30:00Z"
    }
  }
}
```

Sprint-Ergebnisse kommen in `data/sprint-results.json`.

## Deadlines

| Tipp-Art | Deadline |
|---|---|
| Renntipps | Vor Rennstart (`raceStartUTC`) |
| Sprint-Tipps | Vor Sprint-Start (`sprintStartUTC`) |
| Saison-Tipps | Vor Runde 1 |

Verspätete Tipps (`submittedAt` nach Deadline) = **0 Punkte**.

## Punktesystem

### Hauptrennen (max. 26 Punkte)

| Kategorie | Punkte |
|---|---|
| Rennsieger richtig | 5 |
| Podium P1 exakt | 3 |
| Podium P2 exakt | 2 |
| Podium P3 exakt | 2 |
| Podium-Bonus (richtig, falsche Pos.) | 1 je |
| Pole Position | 3 |
| Schnellste Runde | 3 |
| Bester Konstrukteur | 3 |
| Perfekte Runde (alles richtig) | 5 Bonus |

### Sprint (max. 8 Punkte)

| Kategorie | Punkte |
|---|---|
| Sprint-Sieger | 3 |
| Sprint P2 exakt | 1 |
| Sprint P3 exakt | 1 |
| Sprint Podium-Bonus | 1 je |
| Perfekter Sprint | 2 Bonus |

### Saison-Tipps

| Kategorie | Punkte |
|---|---|
| Weltmeister (WDC) | 20 |
| Konstrukteurs-WM (WCC) | 15 |

**Tiebreaker**: Sieger-Tipps > Perfekte Runden > Pole-Tipps

## Fahrer-IDs

| Fahrer | ID | Team |
|---|---|---|
| Lando Norris | `norris` | McLaren |
| Oscar Piastri | `piastri` | McLaren |
| Charles Leclerc | `leclerc` | Ferrari |
| Lewis Hamilton | `hamilton` | Ferrari |
| Max Verstappen | `verstappen` | Red Bull |
| Isack Hadjar | `hadjar` | Red Bull |
| George Russell | `russell` | Mercedes |
| Kimi Antonelli | `antonelli` | Mercedes |
| Fernando Alonso | `alonso` | Aston Martin |
| Lance Stroll | `stroll` | Aston Martin |
| Alex Albon | `albon` | Williams |
| Carlos Sainz | `sainz` | Williams |
| Liam Lawson | `lawson` | Racing Bulls |
| Arvid Lindblad | `lindblad` | Racing Bulls |
| Esteban Ocon | `ocon` | Haas |
| Oliver Bearman | `bearman` | Haas |
| Nico Hülkenberg | `hulkenberg` | Audi |
| Gabriel Bortoleto | `bortoleto` | Audi |
| Pierre Gasly | `gasly` | Alpine |
| Franco Colapinto | `colapinto` | Alpine |
| Valtteri Bottas | `bottas` | Cadillac |
| Sergio Perez | `perez` | Cadillac |

## Team-IDs

`mclaren`, `ferrari`, `redbull`, `mercedes`, `astonmartin`, `williams`, `racingbulls`, `haas`, `audi`, `alpine`, `cadillac`

## Lokale Vorschau

Einfach einen lokalen Webserver starten:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Dann `http://localhost:8000` im Browser öffnen.

## Sprint-Wochenenden 2026

Runde 2 (China), 6 (Miami), 7 (Kanada), 11 (Großbritannien), 14 (Niederlande), 18 (Singapur)
