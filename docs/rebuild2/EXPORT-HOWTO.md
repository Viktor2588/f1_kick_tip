# How to create live-export.json (for Viktor)

The rebuild never connects to Neon. To check that real 2026 data gives identical standings, it needs one export file.

1. Open the Neon console → your project → **SQL Editor**.
2. Run this single query (read-only):

```sql
SELECT json_build_object(
  'race_predictions',   (SELECT coalesce(json_agg(t), '[]') FROM race_predictions t),
  'sprint_predictions', (SELECT coalesce(json_agg(t), '[]') FROM sprint_predictions t),
  'season_predictions', (SELECT coalesce(json_agg(t), '[]') FROM season_predictions t),
  'race_results',       (SELECT coalesce(json_agg(t), '[]') FROM race_results t),
  'sprint_results',     (SELECT coalesce(json_agg(t), '[]') FROM sprint_results t)
) AS export;
```

3. Copy the single cell's value into a file named `live-export.json` and put it in this folder
   (`~/.openrig/workspace/missions/f1-kick-tip-rebuild2/`).

Then tell dev-build. It runs `node scripts/load.js live-export.json` locally: the loader computes the standings with the
**original** scoring code and with the new one and only loads if they are identical. The file stays out of git
(`live-export.json` is git-ignored). It contains tips and results only, no passwords.
