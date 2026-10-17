import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // Run sequentially for reliable multiplayer port coordination
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server/dist/index.js',
    url: 'http://localhost:3001/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
    env: {
      PORT: '3001',
      CLIENT_ORIGIN: 'http://localhost:3001,http://localhost:5173',
      NODE_ENV: 'test',
      PLAYWRIGHT_TEST: 'true',
    },
  },
});
