// Local development: rebuilds the browser app on change and runs the Worker with a local D1 on port 5190.
// On first start it creates the local database and loads the demo season.
import * as esbuild from 'esbuild';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { options } from './build.js';

if (!existsSync('.wrangler/state/v3/d1')) {
  console.log('No local database yet – loading the demo season (fixtures/demo-2026.json) …');
  execFileSync('node', ['scripts/load.js', 'fixtures/demo-2026.json'], { stdio: 'inherit' });
}

const ctx = await esbuild.context({ ...options, minify: false });
await ctx.rebuild();
await ctx.watch();

const wrangler = spawn('npx', ['wrangler', 'dev', '--port', '5190', '--ip', '127.0.0.1', ...process.argv.slice(2)], { stdio: 'inherit' });
const stop = () => { wrangler.kill('SIGINT'); ctx.dispose(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
wrangler.on('exit', (code) => { ctx.dispose(); process.exit(code ?? 0); });
