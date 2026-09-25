import { defineConfig } from '@playwright/test';
const port = Number(process.env.HARMIS_TEST_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Ogiltig HARMIS_TEST_PORT');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', workers: 1,
  use: { baseURL, viewport: { width: 1512, height: 1050 },
    launchOptions: process.env.HARMIS_CHROMIUM ? { executablePath: process.env.HARMIS_CHROMIUM } : {},
  },
  webServer: { command: `pnpm dev --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120000 },
});
