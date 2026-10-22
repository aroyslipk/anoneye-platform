import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit + integration tests run in a Node environment. The local SQLite
 * repository is exercised against an in-memory database; nothing here talks to
 * Meta or Supabase, so no credentials are required.
 */
const testKey = Buffer.alloc(32, 7).toString("base64");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      ANONEYE_ALLOW_LOCAL_BACKEND: "1",
      ANONEYE_DEMO_MODE: "1",
      ANONEYE_LOCAL_DB_PATH: ":memory:",
      TOKEN_ENCRYPTION_KEY: testKey,
    },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Component; tests import
      // server modules directly, so resolve it to an empty module.
      "server-only": fileURLToPath(new URL("./tests/mocks/server-only.ts", import.meta.url)),
    },
  },
});
