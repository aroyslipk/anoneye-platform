import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getEnv,
  isLocalBackendAllowed,
  isSupabaseConfigured,
} from "@/lib/env";
import { ConfigError, UnauthorizedError } from "@/lib/errors";
import { getLocalSessionUser, SESSION_COOKIE } from "@/lib/auth/local-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLocalRepository } from "@/lib/db/local";
import { SupabaseRepository } from "@/lib/db/supabase";
import type { Repository } from "@/lib/db/types";

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  provider: "supabase" | "local";
}

/** True when a session cookie exists and can be verified. */
export async function getSessionUser(): Promise<AuthUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as { sub: string; email?: string; user_metadata?: { display_name?: string } };
    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : "",
      displayName:
        typeof claims.user_metadata?.display_name === "string"
          ? claims.user_metadata.display_name
          : undefined,
      provider: "supabase",
    };
  }

  if (!isLocalBackendAllowed()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = await getLocalSessionUser(token);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    provider: "local",
  };
}

export async function requireUser(nextPath = "/dashboard"): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireApiUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function authBackend(): "supabase" | "local" | "unconfigured" {
  if (isSupabaseConfigured()) return "supabase";
  if (isLocalBackendAllowed()) return "local";
  return "unconfigured";
}

/**
 * Repository for the current request. In Supabase mode queries run with the
 * user's JWT so RLS applies. Local mode is single-user-per-query but still
 * scopes every repository call by owner id.
 */
export function getRepository(): Repository {
  if (isSupabaseConfigured()) {
    return new SupabaseRepository();
  }
  if (isLocalBackendAllowed()) return createLocalRepository();
  throw new ConfigError(
    "No database is configured. Set the Supabase environment variables, or explicitly enable the local backend for development.",
  );
}

/** Service-role repository for the cron worker; never expose to a request. */
export function getPrivilegedRepository(): Repository {
  if (isSupabaseConfigured()) return new SupabaseRepository(true);
  if (isLocalBackendAllowed()) return createLocalRepository();
  throw new ConfigError("No database is configured for scheduled sync");
}

export function sessionCookieSettings() {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production" && env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    priority: "high" as const,
  };
}
