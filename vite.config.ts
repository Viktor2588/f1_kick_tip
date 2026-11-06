import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative base: works on GitHub Pages under /<repo>/ and anywhere else.
  base: './',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'] },
})
