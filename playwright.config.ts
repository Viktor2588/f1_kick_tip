import { defineConfig, devices } from '@playwright/test';

// E2E runs against the dev server with a throwaway copy of the dev fixture and a frozen clock
// (Saturday before the Brazil GP), so results are deterministic.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:5195', ...devices['iPhone 13'], browserName: 'chromium' },
  webServer: {
    command: 'npx vite dev --port 5195 --strictPort',
    port: 5195,
    reuseExistingServer: false,
    env: {
      DATA_SOURCE: 'file',
      DATA_DIR: '.data/e2e',
      DATA_SEED: 'fixtures/dev/game.json',
      NOW_OVERRIDE: '2026-11-07T12:00:00Z',
      ADMIN_PLAYERS: 'viktor',
      PLAYER_PINS: '',
    },
  },
});
