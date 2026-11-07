// Minimal Cloudflare D1 stand-in on node:sqlite, so API code can be tested without wrangler.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Stmt(this.db, this.sql, params); }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params), success: true }; }
  async first(col) { const row = this.db.prepare(this.sql).get(...this.params) ?? null; return col && row ? row[col] : row; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: r.changes } }; }
  _exec() { const s = this.db.prepare(this.sql); return /^\s*(select|with)/i.test(this.sql) ? { results: s.all(...this.params) } : (s.run(...this.params), { results: [] }); }
}

export function createD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const dir = new URL('../../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map((s) => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async exec(sql) { db.exec(sql); },
  };
}
