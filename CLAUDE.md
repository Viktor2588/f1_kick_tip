# F1 Kick Tip – Regeln für Claude

## Update-Nachricht bei jedem Push

Vor jedem Push `LATEST_UPDATE` in `js/app.js` **ersetzen** (nicht ergänzen):

- `id` auf das aktuelle Datum setzen (`YYYY-MM-DD`; bei mehreren Pushes am selben Tag `-2`, `-3` anhängen). Nur eine neue `id` lässt das ⓘ-Icon bei allen wieder erscheinen.
- `items` komplett durch die Änderungen dieses Pushs ersetzen. Alte Punkte fliegen raus, es gibt immer nur **eine** aktuelle Update-Nachricht.
- Kurz, auf Deutsch und für Mitspieler geschrieben (z. B. „Ergebnis Baku ist eingetragen“), nicht für Entwickler („refactor app.js“).
- Die Update-Änderung gehört in denselben Commit wie die eigentliche Änderung.
