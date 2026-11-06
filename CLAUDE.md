# F1 Kick Tip – Regeln für Claude

## Arbeitsprozess

Arbeit läuft über die Single-Agent-Pipeline in `SDLC.md`: Queue in `work/QUEUE.md`,
Zustand in `work/NOTES.md` und `work/slices/`. Eine Iteration mit `/pipeline`, Dauerbetrieb mit `/loop /pipeline`.
Push, PR, Merge nur nach ausdrücklicher Freigabe.

Stack: Vite + Svelte 5 + TypeScript (siehe README). Vor einem Commit: `npm run check && npm test && npm run e2e`.
Lokal nur mit Demo-Daten arbeiten, nie gegen die Live-DB schreiben.

## Update-Nachricht bei jedem Push

Vor jedem Push `LATEST_UPDATE` in `src/updates.ts` **ersetzen** (nicht ergänzen):

- `id` auf das aktuelle Datum setzen (`YYYY-MM-DD`; bei mehreren Pushes am selben Tag `-2`, `-3` anhängen). Nur eine neue `id` lässt das ⓘ-Icon bei allen wieder erscheinen.
- `items` komplett durch die Änderungen dieses Pushs ersetzen. Alte Punkte fliegen raus, es gibt immer nur **eine** aktuelle Update-Nachricht.
- Kurz, auf Deutsch und für Mitspieler geschrieben (z. B. „Ergebnis Baku ist eingetragen“), nicht für Entwickler („refactor app.js“).
- Die Update-Änderung gehört in denselben Commit wie die eigentliche Änderung.
