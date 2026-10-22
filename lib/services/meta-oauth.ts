import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv, isMetaOAuthConfigured, tokenEncryptionAvailable } from "@/lib/env";
import { ConfigError } from "@/lib/errors";
import { encryptToken } from "@/lib/crypto/tokens";
import { graphVersion, GraphApiError } from "@/lib/providers/graph";
import { logger, describeError } from "@/lib/logger";
import type { AuthUser } from "@/lib/auth/session";
import type { Repository } from "@/lib/db/types";
import type { Platform } from "@/lib/providers/types";

/**
 * Meta OAuth (Facebook Login) for connected professional accounts.
 *
 * The authorization-code exchange, long-lived token exchange, permission
 * listing and Page listing all happen server-side. Codes and tokens are never
 * written to logs, returned to the browser, or persisted in plaintext.
 * State is a random 256-bit nonce bound to the signed-in user and platform in
 * an HttpOnly cookie; the callback verifies all three.
 */

export const OAUTH_STATE_COOKIE = "anoneye_meta_oauth";
export const META_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
  "public_profile",
] as const;

const STATE_TTL_SECONDS = 10 * 60;

function graphBaseUrl(): string {
  return `https://graph.facebook.com/${graphVersion()}`;
}

export class OAuthFlowError extends Error {
  constructor(
    readonly code:
      | "not_configured"
      | "state_mismatch"
      | "denied"
      | "no_pages"
      | "no_instagram_professional_account"
      | "exchange_failed"
      | "storage_failed",
    message: string,
  ) {
    super(message);
    this.name = "OAuthFlowError";
  }
}

export function oauthStartState(user: AuthUser, platform: Platform): { state: string; cookieValue: string } {
  const nonce = randomBytes(32).toString("base64url");
  return {
    state: `${nonce}.${platform}`,
    cookieValue: `${nonce}.${platform}.${user.id}`,
  };
}

export function verifyOAuthState(
  cookieValue: string | undefined,
  queryState: string | null,
): { ok: true; platform: Platform; userId: string } | { ok: false } {
  if (!cookieValue || !queryState) return { ok: false };
  const [nonce, platform, userId] = cookieValue.split(".");
  if (!nonce || !userId || (platform !== "instagram" && platform !== "facebook")) return { ok: false };
  const expected = `${nonce}.${platform}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(queryState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  return { ok: true, platform, userId };
}

export function buildDialogUrl(state: string): string {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_REDIRECT_URI || !isMetaOAuthConfigured()) {
    throw new OAuthFlowError("not_configured", "Meta OAuth is not configured");
  }
  const url = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
}
interface AccountsResponse {
  data?: {
    id?: unknown;
    name?: unknown;
    access_token?: unknown;
    instagram_business_account?: { id?: unknown; username?: unknown };
  }[];
}
interface PermissionsResponse {
  data?: { permission?: unknown; status?: unknown }[];
}

async function metaServerJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${graphBaseUrl()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (text.length > 2_000_000) throw new OAuthFlowError("exchange_failed", "Provider response too large");
    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      // Meta error messages can contain the redirect URI and other config.
      // Keep them in a sanitised log event only.
      const code =
        typeof payload === "object" && payload !== null && "error" in payload
          ? (payload as { error?: { code?: number } }).error?.code
          : undefined;
      logger.warn("meta_oauth_request_failed", { status: response.status, code });
      throw new OAuthFlowError("exchange_failed", "Provider rejected the OAuth request");
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new OAuthFlowError("not_configured", "Meta OAuth is not configured");
  }
  return metaServerJson<TokenResponse>("oauth/access_token", {
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: env.META_REDIRECT_URI,
    code,
  });
}

async function exchangeLongLived(shortToken: string): Promise<TokenResponse> {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new OAuthFlowError("not_configured", "Meta OAuth is not configured");
  }
  return metaServerJson<TokenResponse>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: shortToken,
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function connectMetaAccount(options: {
  code: string;
  user: AuthUser;
  repo: Repository;
  platform: Platform;
}): Promise<{ connected: number; platform: Platform }> {
  if (!isMetaOAuthConfigured()) throw new OAuthFlowError("not_configured", "Meta OAuth is not configured");
  if (!tokenEncryptionAvailable()) {
    throw new OAuthFlowError(
      "not_configured",
      "TOKEN_ENCRYPTION_KEY is required to store connected-account credentials",
    );
  }

  const short = await exchangeCode(options.code);
  const shortToken = asString(short.access_token);
  if (!shortToken) throw new OAuthFlowError("exchange_failed", "No access token was returned");

  const long = await exchangeLongLived(shortToken);
  const userToken = asString(long.access_token) ?? shortToken;
  const expiresIn = typeof long.expires_in === "number" ? long.expires_in : undefined;
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;

  const permissions = await metaServerJson<PermissionsResponse>("me/permissions", {
    access_token: userToken,
    limit: "100",
  }).catch(() => null);
  const grantedScopes =
    permissions?.data
      ?.filter((entry) => entry.status === "granted")
      .map((entry) => asString(entry.permission))
      .filter((value): value is string => Boolean(value)) ?? [...META_SCOPES];

  const accounts = await metaServerJson<AccountsResponse>("me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  const pages = accounts.data ?? [];

  let connected = 0;
  const encryptedUserToken = encryptToken(userToken);

  if (options.platform === "instagram") {
    for (const page of pages) {
      const igId = asString(page.instagram_business_account?.id);
      const pageId = asString(page.id);
      if (!igId) continue;
      const username = asString(page.instagram_business_account?.username);
      const displayName = [username ? `@${username}` : undefined, asString(page.name), pageId ? `page ${pageId}` : undefined]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 160);
      await options.repo.saveConnectedAccount({
        ownerId: options.user.id,
        platform: "instagram",
        providerAccountId: igId,
        displayName: displayName || "Instagram professional account",
        grantedScopes,
        tokenCiphertext: encryptedUserToken,
        tokenExpiresAt,
      });
      connected += 1;
    }
    if (connected === 0) {
      throw new OAuthFlowError(
        "no_instagram_professional_account",
        "No Instagram professional account was linked to an accessible Facebook Page",
      );
    }
  } else {
    for (const page of pages) {
      const pageId = asString(page.id);
      if (!pageId) continue;
      const pageToken = asString(page.access_token) ?? userToken;
      await options.repo.saveConnectedAccount({
        ownerId: options.user.id,
        platform: "facebook",
        providerAccountId: pageId,
        displayName: asString(page.name) ?? `Page ${pageId}`,
        grantedScopes,
        tokenCiphertext: encryptToken(pageToken),
        // Page tokens obtained from a long-lived user token are typically
        // long-lived; if Meta expires one, the sync fails and asks to reconnect.
        tokenExpiresAt: undefined,
      });
      connected += 1;
    }
    if (connected === 0) {
      throw new OAuthFlowError("no_pages", "No Facebook Pages were returned for this account");
    }
  }

  logger.info("meta_accounts_connected", {
    userId: options.user.id,
    platform: options.platform,
    count: connected,
  });
  return { connected, platform: options.platform };
}

export function oauthStateCookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/api/oauth/meta",
    maxAge: STATE_TTL_SECONDS,
  };
}

export function describeOAuthError(error: unknown): string {
  if (error instanceof OAuthFlowError) return error.code;
  if (error instanceof GraphApiError) return "provider_error";
  logger.error("oauth_unexpected_error", { error: describeError(error) });
  return "unexpected";
}

export function assertOAuthReady(): void {
  if (!isMetaOAuthConfigured()) {
    throw new ConfigError("Meta OAuth credentials are missing");
  }
  if (!tokenEncryptionAvailable()) {
    throw new ConfigError("TOKEN_ENCRYPTION_KEY is missing or invalid");
  }
}
