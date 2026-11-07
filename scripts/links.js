// Create personal links for players. Only a SHA-256 hash of each token is stored in the database.
//
//   node scripts/links.js [playerId ...] [--admin viktor] [--base http://127.0.0.1:5190] [--remote]
//
// Without player ids, every player gets a NEW link (old links stop working). The links are written to
// .wrangler/links.txt (git-ignored) and not printed, so they don't end up in logs. Hand each player their own link.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { newToken, sha256 } from '../src/worker/app.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const flagValues = new Set([opt('--admin'), opt('--base')].filter(Boolean));
const where = args.includes('--remote') ? '--remote' : '--local';
const base = opt('--base', 'http://127.0.0.1:5190').replace(/\/$/, '');
const admin = opt('--admin');
const season = JSON.parse(readFileSync('seed/season-2026.json', 'utf8'));
const ids = args.filter((a) => !a.startsWith('--') && !flagValues.has(a));
const players = ids.length ? ids : season.players.map((p) => p.id);

const lines = [];
const sql = [];
for (const id of players) {
  const token = newToken();
  sql.push(`UPDATE players SET token_hash = '${await sha256(token)}' WHERE id = '${id.replaceAll("'", "''")}';`);
  lines.push(`${id}\t${base}/join/${token}`);
}
if (admin) sql.push(`UPDATE players SET is_admin = (id = '${admin.replaceAll("'", "''")}');`);

mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/links.sql', sql.join('\n') + '\n');
execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', where, '--file', '.wrangler/links.sql'], { stdio: ['ignore', 'ignore', 'inherit'] });
writeFileSync('.wrangler/links.txt', lines.join('\n') + '\n', { mode: 0o600 });
console.log(`New links for ${players.join(', ')} written to .wrangler/links.txt${admin ? ` (admin: ${admin})` : ''}.`);
