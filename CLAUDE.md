# F1 Kick Tip – Regeln für Claude

## Arbeitsprozess

Arbeit läuft über die Single-Agent-Pipeline in `SDLC.md`: Queue in `work/QUEUE.md`,
Zustand in `work/NOTES.md` und `work/slices/`. Eine Iteration mit `/pipeline`, Dauerbetrieb mit `/loop /pipeline`.
Nach einer Komprimierung oder in einer neuen Session zuerst `work/NOTES.md` und `work/QUEUE.md` lesen.
Push, PR, Merge nur nach ausdrücklicher Freigabe.

## Prüfen vor jedem Commit

`npm run check && npm test && npm run test:e2e` – alles grün. Punkte-Logik nur mit Test ändern;
`tests/unit/parity.test.ts` muss grün bleiben, außer Viktor will eine Regeländerung.

## Update-Nachricht bei jedem Push

Vor jedem Push `LATEST_UPDATE` in `src/lib/update.ts` **ersetzen** (nicht ergänzen):

- `id` auf das aktuelle Datum setzen (`YYYY-MM-DD`; bei mehreren Pushes am selben Tag `-2`, `-3` anhängen). Nur eine neue `id` lässt das ⓘ-Icon bei allen wieder erscheinen.
- `items` komplett durch die Änderungen dieses Pushs ersetzen. Alte Punkte fliegen raus, es gibt immer nur **eine** aktuelle Update-Nachricht.
- Kurz, auf Deutsch und für Mitspieler geschrieben (z. B. „Ergebnis Baku ist eingetragen“), nicht für Entwickler („refactor app.js“).
- Die Update-Änderung gehört in denselben Commit wie die eigentliche Änderung.
