import { afterEach, describe, expect, it, vi } from "vitest";
import {
  META_SCOPES,
  buildDialogUrl,
  oauthStartState,
  oauthStateCookieOptions,
  verifyOAuthState,
} from "@/lib/services/meta-oauth";
import { resetEnvCacheForTests } from "@/lib/env";
import type { AuthUser } from "@/lib/auth/session";

const user: AuthUser = { id: "user-123", email: "person@example.com", provider: "local" };

afterEach(() => {
  resetEnvCacheForTests();
  vi.unstubAllEnvs();
});

describe("Meta OAuth state", () => {
  it("issues a state whose cookie keeps the user id out of the query", () => {
    const { state, cookieValue } = oauthStartState(user, "instagram");
    expect(state).not.toContain(user.id);
    expect(cookieValue).toContain(user.id);
    expect(state.split(".")).toHaveLength(2);
  });

  it("verifies a matching state and returns the right platform/user", () => {
    const { state, cookieValue } = oauthStartState(user, "facebook");
    expect(verifyOAuthState(cookieValue, state)).toEqual({
      ok: true,
      platform: "facebook",
      userId: user.id,
    });
  });

  it("rejects a missing, swapped, mismatched or truncated state", () => {
    const a = oauthStartState(user, "instagram");
    const b = oauthStartState(user, "instagram");
    expect(verifyOAuthState(undefined, a.state)).toEqual({ ok: false });
    expect(verifyOAuthState(a.cookieValue, null)).toEqual({ ok: false });
    expect(verifyOAuthState(a.cookieValue, b.state)).toEqual({ ok: false });
    expect(verifyOAuthState(a.cookieValue, a.state.slice(0, -1))).toEqual({ ok: false });
    expect(verifyOAuthState(a.cookieValue.replace("instagram", "facebook"), a.state)).toEqual({ ok: false });
    expect(verifyOAuthState("garbage", "garbage")).toEqual({ ok: false });
  });

  it("uses a narrow, httpOnly, 10-minute cookie", () => {
    const options = oauthStateCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/api/oauth/meta");
    expect(options.maxAge).toBe(600);
  });
});

describe("buildDialogUrl", () => {
  it("throws a typed error when OAuth is not configured", () => {
    expect(() => buildDialogUrl("state")).toThrow(/not configured/i);
  });

  it("targets facebook.com with the documented scopes and no token in the URL", () => {
    resetEnvCacheForTests();
    vi.stubEnv("META_APP_ID", "app-id");
    vi.stubEnv("META_APP_SECRET", "app-secret");
    vi.stubEnv("META_REDIRECT_URI", "https://example.com/api/oauth/meta/callback");
    resetEnvCacheForTests();

    const url = new URL(buildDialogUrl("nonce.instagram"));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toMatch(/^\/v\d+\.\d+\/dialog\/oauth$/);
    expect(url.searchParams.get("client_id")).toBe("app-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/api/oauth/meta/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("nonce.instagram");
    expect(url.toString()).not.toContain("app-secret");
    for (const scope of META_SCOPES) {
      expect(url.searchParams.get("scope")).toContain(scope);
    }
  });
});
