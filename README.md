# F1 Kick Tip

Tippspiel für die Formel-1-Saison von Thomas, Julia und Viktor. Mobile-first Web-App (PWA).

## Stack

Vite + Svelte 5 + TypeScript. Daten in Neon Postgres (gleiche Tabellen wie die alte App, keine Migration).
Ohne `VITE_NEON_URL` läuft die App mit **Demo-Daten** im Browser, so wird beim Entwickeln nie live geschrieben.

```
src/domain/   Regeln, Punkte, Tabelle, Fristen (reines TS, getestet)
src/data/     season.json (Kalender, Fahrer, Teams), Neon- und Demo-Adapter
src/lib/      Store, Router (Hash), Uhr, Formatierung, Kalender-Export
src/pages/    Start, Rennen, Tippen, Tabelle, Regeln, Admin
src/ui/       Bausteine (Bottom-Sheet, Fahrer-Picker, Countdown, Diagramm)
```

## Entwickeln

```bash
npm install
npm run dev          # Demo-Daten
npm test             # Punkte-Regeln (Vitest)
npm run e2e          # Klick-Tests auf Handybreite (Playwright)
npm run check        # Typen
```

Demo-Zeit simulieren: `http://localhost:5173/?now=2026-11-08T18:00:00Z#/` (nur im Demo-Modus).
Live-Daten lokal: `.env.local` mit `VITE_NEON_URL=…` (Achtung: schreibt in die echte DB).

## Saison pflegen

- Kalender, Fahrer, Teams: `src/data/season.json`
- Weltmeister nach dem Finale: in `season.json` `"final": { "wdc": "<fahrer>", "wcc": "<team>" }` eintragen. Damit werden die Saison-Tipps gewertet.
- Ergebnisse: in der App unter Regeln → „Ergebnisse eintragen“ (`#/admin`).
- Punkte-Regeln: nur `src/domain/rules.ts`. Regelseite und Tippformular lesen von dort.

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) baut bei Push auf `main` und veröffentlicht `dist/` auf GitHub Pages.
Nötig: Repo-Secret `NEON_DATABASE_URL` und Pages-Quelle „GitHub Actions“.
