import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against a real Next.js dev server with the local SQLite
 * backend and demo fixtures enabled. No Meta/Supabase credentials are needed.
 *
 * `npx playwright install chromium` is required once before the first run.
 * The suite is Chromium-only on purpose: the UI has no browser-specific code
 * paths, and a single engine keeps CI time and cost predictable.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    video: "off",
    locale: "bn-BD",
    timezoneId: "Asia/Dhaka",
  },
  webServer: {
    command: "npm run dev -- --port 3100 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
      ANONEYE_ALLOW_LOCAL_BACKEND: "1",
      ANONEYE_DEMO_MODE: "1",
      ANONEYE_LOCAL_DB_PATH: ".data/e2e.db",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
