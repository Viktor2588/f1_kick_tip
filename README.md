# F1 Kick Tip 2026 – v2

Tippspiel für die Formel-1-Saison. Thomas, Julia und Viktor tippen vor jedem Rennen; die App wertet aus.

v2 ist ein kompletter Neubau (SvelteKit 2, Svelte 5, TypeScript). Die alte statische Seite liegt zum Nachschlagen in `legacy/`.

## Was v2 anders macht

| Thema | v1 (statisch) | v2 |
|---|---|---|
| Datenbank-Zugang | Neon-Owner-Zugangsdaten im Browser-JS: jeder konnte alles lesen und löschen | Zugangsdaten nur auf dem Server (`DATABASE_URL`) |
| Wer bin ich? | Name im localStorage, jeder konnte für jeden tippen | PIN pro Spieler, signiertes Cookie (1 Jahr), Bremse gegen Durchprobieren |
| Geheime Tipps | Alle Tipps gingen an jeden Browser, nur die Anzeige war verdeckt | Offene Tipps der anderen verlassen den Server nicht |
| Deadline | Browser-Uhr; verspätete Tipps wurden gespeichert und still mit 0 gewertet | Server prüft die Deadline und lehnt ab |
| Saison-Tipps | Wurden nie gewertet, nie gesperrt | Gesperrt ab Runde 1, gewertet sobald `final` in `season.json` steht |
| Ergebnisse eintragen | Alles von Hand | „Von F1-API laden“ (Jolpica) füllt alles vor, inkl. bestem Konstrukteur und DNF/DNS; Punkte-Vorschau vor dem Speichern |
| Regeln-Seite | Von Hand gepflegt (Sprint-Runden waren falsch) | Aus Punktetabelle und Kalender erzeugt |

Punkte werden **identisch** zu v1 berechnet (geprüft gegen den eingefrorenen alten Code, s. Tests). Einzige Ausnahme: ein leerer Tipp trifft kein leeres Ergebnisfeld mehr (v1 gab dafür Punkte).

## Lokal starten

```bash
npm install
cp .env.example .env   # DATA_SOURCE=file → lokale Testdaten, PIN für alle: 0000, Admin: viktor
npm run dev
```

Testdaten: `fixtures/dev/game.json` (echte Ergebnisse R1–R19 + zufällige Tipps). Beim ersten Start nach `.data/dev/` kopiert; löschen setzt zurück. Neu erzeugen: `npx vite-node scripts/make-dev-fixture.ts`.

Mit `NOW_OVERRIDE=2026-11-07T12:00:00Z` läuft die App mit fester Uhrzeit (Deadlines, Countdown, Aufdecken).

## Tests

```bash
npm test            # Unit: Punkte, Gleichstand, Deadlines, Verdecken, Validierung, API-Import, Parität zu v1
npm run test:e2e    # Playwright (iPhone-Größe): Login, Tippen/Ändern, Verdecken, Deadline-Sperre, Admin, kein Seitwärts-Scrollen
npm run check       # Typen
```

`npm run test:e2e` legt außerdem Screenshots in `test-results/shots/` ab.

## Produktion

Läuft überall, wo Node läuft (`npm run build && npm start`, Adapter: `@sveltejs/adapter-node`). Für Vercel/Netlify/Cloudflare nur den Adapter in `svelte.config.js` tauschen.

Umgebungsvariablen (siehe `.env.example`):

- `DATA_SOURCE=neon`, `DATABASE_URL=…` – dieselbe Neon-Datenbank wie v1, **ohne Migration** (gleiche Tabellen/Spalten)
- `SESSION_SECRET` – langer Zufallswert (`openssl rand -hex 32`)
- `PLAYER_PINS` – `{"thomas":"<hash>","julia":"<hash>","viktor":"<hash>"}`, Hash per `npm run pin -- 1234`
- `ADMIN_PLAYERS=viktor`

### Umstieg von v1

1. Vor dem Umstieg mit echten Daten prüfen (nur lesend): `DATABASE_URL=… npx vite-node scripts/verify-prod.ts` – vergleicht die Tabelle alt/neu.
2. v2 deployen, PINs verteilen.
3. **Neon-Passwort rotieren** (Neon-Konsole → Roles → Reset password). Das alte steht öffentlich im v1-Code und in der Git-History; erst die Rotation sperrt es aus. Danach nur noch in der Server-Umgebung von v2 eintragen.
4. GitHub-Pages-Seite von v1 abschalten oder auf v2 weiterleiten.

### Saisonende

In `src/lib/domain/season.json` `"final": { "wdc": "<fahrer>", "wcc": "<team>" }` eintragen → Saison-Tipps zählen.

## Aufbau

```
src/lib/domain/      Spielregeln, rein und testbar: scoring, schedule (Deadlines/Verdecken), validate, season.json
src/lib/server/      Server-only: config, auth (PIN/Cookie), store/{file,neon}, jolpica (Ergebnis-Import)
src/lib/components/  UI: SlotForm + PickerSheet (Tipp-Eingabe), TipMatrix, PointsChart, TabBar …
src/routes/          Start, /rennen, /rennen/[runde], /tabelle, /saison, /regeln, /mehr, /login, /admin
tests/unit, tests/e2e
```

Spieler-, Fahrer-, Team- und Rennliste: `src/lib/domain/season.json`.
