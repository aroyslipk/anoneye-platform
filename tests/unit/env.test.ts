import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configStatus,
  getEnv,
  isDemoMode,
  isLocalBackendAllowed,
  isMetaOAuthConfigured,
  isMetaLookupConfigured,
  isSupabaseConfigured,
  publicConfig,
  resetEnvCacheForTests,
} from "@/lib/env";

afterEach(() => {
  resetEnvCacheForTests();
  vi.unstubAllEnvs();
});

describe("environment validation", () => {
  it("reports a local/demo backend in tests without leaking secrets", () => {
    const status = configStatus();
    expect(status.backend).toBe("local");
    expect(status.demoMode).toBe(true);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(process.env.TOKEN_ENCRYPTION_KEY ?? "@@missing@@");
    expect(serialized.toLowerCase()).not.toContain("token_encryption_key");
  });

  it("exposes only public values in publicConfig", () => {
    expect(Object.keys(publicConfig).sort()).toEqual(["contactEmail", "siteUrl"]);
    expect(publicConfig.siteUrl).toBe("http://localhost:3100");
  });

  it("reports missing integrations instead of pretending they work", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(isMetaOAuthConfigured()).toBe(false);
    expect(isMetaLookupConfigured()).toBe(false);
    expect(isDemoMode()).toBe(true);
    expect(isLocalBackendAllowed()).toBe(true);
  });

  it("requires both Supabase values before claiming a Supabase backend", () => {
    resetEnvCacheForTests();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    resetEnvCacheForTests();
    expect(isSupabaseConfigured()).toBe(true);
    expect(configStatus().backend).toBe("supabase");
  });

  it("validates the encryption key shape without throwing at import time", () => {
    resetEnvCacheForTests();
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "not-base64");
    const status = configStatus();
    expect(status.issues.some((issue) => issue.key === "token-encryption")).toBe(true);
    // A bad optional key must not crash the whole application.
    expect(() => getEnv()).not.toThrow();
  });
});
