import { defineConfig } from '@playwright/test'

// CI runs `npm run check` (which builds dist) before the E2E step, so it can
// skip a second full build and go straight to the preview server.
const skipBuild = Boolean(process.env.PLAYWRIGHT_SKIP_BUILD)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    // Bind IPv4 explicitly: some CI runners resolve `localhost` to ::1 first,
    // while Playwright polls 127.0.0.1 and would wait out the full timeout.
    command: `${skipBuild ? '' : 'npm run build && '}npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000
  }
})
