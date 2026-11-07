// Bundles the browser app (src/client) into public/app.js.
import * as esbuild from 'esbuild';

export const options = {
  entryPoints: ['src/client/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'public/app.js',
  sourcemap: true,
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
};

if (import.meta.url === `file://${process.argv[1]}`) await esbuild.build(options);
