-- F1 Kick Tip – initial schema (Cloudflare D1 / SQLite).
-- Tip and result columns mirror the 2026 app's rows 1:1 so imports are lossless.

CREATE TABLE players (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#888888',
  is_admin    INTEGER NOT NULL DEFAULT 0,
  token_hash  TEXT UNIQUE,            -- SHA-256 of the personal link token; the token itself is never stored
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE teams (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  color  TEXT NOT NULL,
  sort   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE drivers (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  number   INTEGER,
  team_id  TEXT NOT NULL REFERENCES teams(id),
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE races (
  round         INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_code  TEXT NOT NULL,
  circuit       TEXT NOT NULL,
  city          TEXT NOT NULL,
  date          TEXT NOT NULL,
  quali_start   TEXT,
  sprint_start  TEXT,
  race_start    TEXT NOT NULL,
  sprint        INTEGER NOT NULL DEFAULT 0,
  dnf_dns       INTEGER NOT NULL DEFAULT 0   -- DNF/DNS tips offered (from round 16)
);

CREATE TABLE race_tips (
  round             INTEGER NOT NULL REFERENCES races(round),
  player_id         TEXT NOT NULL REFERENCES players(id),
  winner            TEXT,
  p1                TEXT,
  p2                TEXT,
  p3                TEXT,
  pole              TEXT,
  fastest_lap       TEXT,
  best_constructor  TEXT,
  dnf               TEXT,
  dns               TEXT,
  submitted_at      TEXT,
  PRIMARY KEY (round, player_id)
);

CREATE TABLE sprint_tips (
  round         INTEGER NOT NULL REFERENCES races(round),
  player_id     TEXT NOT NULL REFERENCES players(id),
  winner        TEXT,
  p1            TEXT,
  p2            TEXT,
  p3            TEXT,
  submitted_at  TEXT,
  PRIMARY KEY (round, player_id)
);

CREATE TABLE season_tips (
  player_id     TEXT PRIMARY KEY REFERENCES players(id),
  wdc           TEXT,
  wcc           TEXT,
  submitted_at  TEXT
);

CREATE TABLE race_results (
  round             INTEGER PRIMARY KEY REFERENCES races(round),
  winner            TEXT,
  p1                TEXT,
  p2                TEXT,
  p3                TEXT,
  pole              TEXT,
  fastest_lap       TEXT,
  best_constructor  TEXT,
  top_ten           TEXT,   -- JSON array or NULL
  dnf               TEXT,   -- JSON array or NULL (NULL = round had no DNF/DNS scoring)
  dns               TEXT,   -- JSON array or NULL
  entered_at        TEXT
);

CREATE TABLE sprint_results (
  round       INTEGER PRIMARY KEY REFERENCES races(round),
  winner      TEXT,
  p1          TEXT,
  p2          TEXT,
  p3          TEXT,
  entered_at  TEXT
);

CREATE TABLE season_final (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  wdc  TEXT,
  wcc  TEXT
);

CREATE TABLE news (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL,
  items  TEXT NOT NULL      -- JSON array of short German lines
);
