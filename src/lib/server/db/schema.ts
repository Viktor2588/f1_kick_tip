import { boolean, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const seasons = pgTable('seasons', {
  year: integer('year').primaryKey(),
  wdc: text('wdc'), // final champion driver, set at season end
  wcc: text('wcc'), // final constructors' champion
});

export const teams = pgTable('teams', {
  season: integer('season').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
}, t => [primaryKey({ columns: [t.season, t.id] })]);

export const drivers = pgTable('drivers', {
  season: integer('season').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  number: integer('number').notNull(),
  teamId: text('team_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, t => [primaryKey({ columns: [t.season, t.id] })]);

export const races = pgTable('races', {
  season: integer('season').notNull(),
  round: integer('round').notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  countryCode: text('country_code').notNull(),
  circuit: text('circuit').notNull(),
  city: text('city').notNull(),
  date: text('date').notNull(),
  qualiStart: text('quali_start'),
  sprintStart: text('sprint_start'),
  raceStart: text('race_start').notNull(),
  sprint: boolean('sprint').notNull().default(false),
}, t => [primaryKey({ columns: [t.season, t.round] })]);

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  color: text('color').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  loginTokenHash: text('login_token_hash'),
  sortOrder: integer('sort_order').notNull().default(0), // legacy season.json order; decides full ties
});

export const raceTips = pgTable('race_tips', {
  season: integer('season').notNull(),
  round: integer('round').notNull(),
  playerId: text('player_id').notNull(),
  winner: text('winner'),
  podiumP1: text('podium_p1'),
  podiumP2: text('podium_p2'),
  podiumP3: text('podium_p3'),
  pole: text('pole'),
  fastestLap: text('fastest_lap'),
  bestConstructor: text('best_constructor'),
  dnf: text('dnf'),
  dns: text('dns'),
  submittedAt: text('submitted_at'),
}, t => [primaryKey({ columns: [t.season, t.round, t.playerId] })]);

export const sprintTips = pgTable('sprint_tips', {
  season: integer('season').notNull(),
  round: integer('round').notNull(),
  playerId: text('player_id').notNull(),
  winner: text('winner'),
  podiumP1: text('podium_p1'),
  podiumP2: text('podium_p2'),
  podiumP3: text('podium_p3'),
  submittedAt: text('submitted_at'),
}, t => [primaryKey({ columns: [t.season, t.round, t.playerId] })]);

export const seasonTips = pgTable('season_tips', {
  season: integer('season').notNull(),
  playerId: text('player_id').notNull(),
  wdc: text('wdc'),
  wcc: text('wcc'),
  submittedAt: text('submitted_at'),
}, t => [primaryKey({ columns: [t.season, t.playerId] })]);

export const raceResults = pgTable('race_results', {
  season: integer('season').notNull(),
  round: integer('round').notNull(),
  winner: text('winner'),
  podiumP1: text('podium_p1'),
  podiumP2: text('podium_p2'),
  podiumP3: text('podium_p3'),
  pole: text('pole'),
  fastestLap: text('fastest_lap'),
  bestConstructor: text('best_constructor'),
  topTen: text('top_ten').array(),
  dnf: text('dnf').array(),
  dns: text('dns').array(),
  enteredAt: text('entered_at'),
}, t => [primaryKey({ columns: [t.season, t.round] })]);

export const sprintResults = pgTable('sprint_results', {
  season: integer('season').notNull(),
  round: integer('round').notNull(),
  winner: text('winner'),
  podiumP1: text('podium_p1'),
  podiumP2: text('podium_p2'),
  podiumP3: text('podium_p3'),
  enteredAt: text('entered_at'),
}, t => [primaryKey({ columns: [t.season, t.round] })]);

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  playerId: text('player_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** Idempotent DDL matching the tables above (kept next to them so they stay in sync). */
export const DDL = `
CREATE TABLE IF NOT EXISTS seasons (year integer PRIMARY KEY, wdc text, wcc text);
CREATE TABLE IF NOT EXISTS teams (season integer NOT NULL, id text NOT NULL, name text NOT NULL, color text NOT NULL, PRIMARY KEY (season, id));
CREATE TABLE IF NOT EXISTS drivers (season integer NOT NULL, id text NOT NULL, name text NOT NULL, number integer NOT NULL, team_id text NOT NULL, sort_order integer NOT NULL DEFAULT 0, PRIMARY KEY (season, id));
CREATE TABLE IF NOT EXISTS races (season integer NOT NULL, round integer NOT NULL, name text NOT NULL, country text NOT NULL, country_code text NOT NULL, circuit text NOT NULL, city text NOT NULL, date text NOT NULL, quali_start text, sprint_start text, race_start text NOT NULL, sprint boolean NOT NULL DEFAULT false, PRIMARY KEY (season, round));
CREATE TABLE IF NOT EXISTS players (id text PRIMARY KEY, name text NOT NULL, emoji text NOT NULL, color text NOT NULL, is_admin boolean NOT NULL DEFAULT false, login_token_hash text, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS race_tips (season integer NOT NULL, round integer NOT NULL, player_id text NOT NULL, winner text, podium_p1 text, podium_p2 text, podium_p3 text, pole text, fastest_lap text, best_constructor text, dnf text, dns text, submitted_at text, PRIMARY KEY (season, round, player_id));
CREATE TABLE IF NOT EXISTS sprint_tips (season integer NOT NULL, round integer NOT NULL, player_id text NOT NULL, winner text, podium_p1 text, podium_p2 text, podium_p3 text, submitted_at text, PRIMARY KEY (season, round, player_id));
CREATE TABLE IF NOT EXISTS season_tips (season integer NOT NULL, player_id text NOT NULL, wdc text, wcc text, submitted_at text, PRIMARY KEY (season, player_id));
CREATE TABLE IF NOT EXISTS race_results (season integer NOT NULL, round integer NOT NULL, winner text, podium_p1 text, podium_p2 text, podium_p3 text, pole text, fastest_lap text, best_constructor text, top_ten text[], dnf text[], dns text[], entered_at text, PRIMARY KEY (season, round));
CREATE TABLE IF NOT EXISTS sprint_results (season integer NOT NULL, round integer NOT NULL, winner text, podium_p1 text, podium_p2 text, podium_p3 text, entered_at text, PRIMARY KEY (season, round));
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, player_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
`;
