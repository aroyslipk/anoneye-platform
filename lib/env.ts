import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Nothing here throws at import time: a missing integration is a supported
 * state in Anoneye, and the build must not depend on production secrets.
 * Features ask `configStatus()` whether they can run and show a precise,
 * secret-free explanation when they cannot.
 *
 * This module must never be imported from a Client Component. Only values
 * prefixed NEXT_PUBLIC_ ever reach the browser, and those are read from
 * `publicConfig` below.
 */

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().optional(),
);

const flag = z
  .enum(["0", "1", "true", "false"])
  .optional()
  .transform((value) => value === "1" || value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().trim().url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_REDIRECT_URI: optionalUrl,
  META_ACCESS_TOKEN: optionalString,
  INSTAGRAM_BUSINESS_ID: optionalString,
  FACEBOOK_PAGE_ACCESS_TOKEN: optionalString,
  META_GRAPH_VERSION: z
    .string()
    .regex(/^v\d{1,3}\.\d{1,2}$/, "must look like v26.0")
    .default("v26.0"),

  TOKEN_ENCRYPTION_KEY: optionalString,
  CRON_SECRET: optionalString,
  CONTACT_EMAIL: optionalString,

  ANONEYE_DEMO_MODE: flag,
  ANONEYE_ALLOW_LOCAL_BACKEND: flag,
  ANONEYE_LOCAL_DB_PATH: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export interface ConfigIssue {
  key: string;
  message: string;
}

interface EnvState {
  env: Env;
  issues: ConfigIssue[];
  valid: boolean;
}

let cached: EnvState | null = null;

function buildState(): EnvState {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    const issues: ConfigIssue[] = [];
    const env = parsed.data;

    // Pairwise checks: a half-configured integration is a configuration error,
    // not something we silently ignore.
    const supabaseUrlSet = Boolean(env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKeySet = Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if (supabaseUrlSet !== supabaseKeySet) {
      issues.push({
        key: "supabase",
        message:
          "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set together.",
      });
    }
    const metaOauthParts = [env.META_APP_ID, env.META_APP_SECRET, env.META_REDIRECT_URI].filter(Boolean);
    if (metaOauthParts.length > 0 && metaOauthParts.length < 3) {
      issues.push({
        key: "meta-oauth",
        message: "META_APP_ID, META_APP_SECRET and META_REDIRECT_URI must all be set to enable OAuth.",
      });
    }
    if (env.META_ACCESS_TOKEN && !env.INSTAGRAM_BUSINESS_ID) {
      issues.push({
        key: "meta-server-token",
        message: "INSTAGRAM_BUSINESS_ID is required alongside META_ACCESS_TOKEN for Instagram lookups.",
      });
    }
    if (env.TOKEN_ENCRYPTION_KEY) {
      const bytes = decodeBase64Key(env.TOKEN_ENCRYPTION_KEY);
      if (!bytes || bytes.length !== 32) {
        issues.push({
          key: "token-encryption",
          message: "TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
        });
      }
    }
    return { env, issues, valid: issues.length === 0 };
  }

  const issues: ConfigIssue[] = parsed.error.issues.map((issue) => ({
    key: issue.path.join(".") || "environment",
    // Zod messages never include the submitted value, so this is secret-safe.
    message: issue.message,
  }));
  // Still return defaults for runtime so public pages can render.
  const fallback = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  });
  return { env: fallback, issues, valid: false };
}

export function getEnvState(): EnvState {
  if (!cached) cached = buildState();
  return cached;
}

export function getEnv(): Env {
  return getEnvState().env;
}

export function resetEnvCacheForTests(): void {
  cached = null;
}

export function decodeBase64Key(value: string): Buffer | null {
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isMetaOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI);
}

export function isMetaServerTokenConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.META_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ID) || Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN);
}

export function isMetaLookupConfigured(): boolean {
  return isMetaOAuthConfigured() || isMetaServerTokenConfigured();
}

export function isDemoMode(): boolean {
  return getEnv().ANONEYE_DEMO_MODE;
}

/**
 * The local SQLite backend exists so the product can be run and reviewed
 * without external services. It is a single-process development/demo store:
 * it is never enabled implicitly in a production deployment.
 */
export function isLocalBackendAllowed(): boolean {
  const env = getEnv();
  if (env.ANONEYE_ALLOW_LOCAL_BACKEND) return true;
  if (env.NODE_ENV === "production") return false;
  return !isSupabaseConfigured();
}


export function tokenEncryptionAvailable(): boolean {
  const key = getEnv().TOKEN_ENCRYPTION_KEY;
  return Boolean(key && decodeBase64Key(key));
}

export interface ConfigStatus {
  backend: "supabase" | "local" | "unconfigured";
  supabase: "configured" | "missing" | "invalid";
  metaOAuth: "configured" | "missing" | "invalid";
  metaServerToken: "configured" | "missing";
  demoMode: boolean;
  /**
   * Third-party media downloads are intentionally not implemented: Meta
   * documents no authorised download endpoint for other accounts' photos or
   * reels. The flag is always false and exists only to surface that in /settings.
   */
  mediaDownload: false;
  issues: ConfigIssue[];
}

/** Secret-free configuration summary, safe to render in the UI. */
export function configStatus(): ConfigStatus {
  const state = getEnvState();
  const issues = state.issues;
  const supabaseIssue = issues.some((issue) => issue.key === "supabase");
  const metaIssue = issues.some((issue) => issue.key === "meta-oauth");
  const supabaseConfigured = isSupabaseConfigured();

  return {
    backend: supabaseConfigured ? "supabase" : isLocalBackendAllowed() ? "local" : "unconfigured",
    supabase: supabaseConfigured && !supabaseIssue ? "configured" : supabaseIssue ? "invalid" : "missing",
    metaOAuth: isMetaOAuthConfigured() ? "configured" : metaIssue ? "invalid" : "missing",
    metaServerToken: isMetaServerTokenConfigured() ? "configured" : "missing",
    demoMode: isDemoMode(),
    mediaDownload: false,
    issues,
  };
}

/**
 * Throws a configuration error only at the point a feature actually needs the
 * missing value. Route handlers convert this into an actionable 503.
 */
export function requireSupabase(): { url: string; key: string } {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

export const publicConfig = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.CONTACT_EMAIL || "",
} as const;
