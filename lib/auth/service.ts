import "server-only";
import { cookies } from "next/headers";
import { getEnv, isLocalBackendAllowed, isSupabaseConfigured } from "@/lib/env";
import { ConfigError } from "@/lib/errors";
import {
  createLocalSession,
  createLocalUser,
  deleteLocalSession,
  getLocalSessionUser,
  LocalAuthError,
  normalizeEmail,
  SESSION_COOKIE,
  deleteLocalUser,
} from "./local-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sessionCookieSettings } from "./session";
import type { AuthUser } from "./session";

export interface AuthResult {
  user?: AuthUser;
  requiresEmailConfirmation?: boolean;
  message?: string;
}

export class AuthServiceError extends Error {
  constructor(
    readonly code:
      | "email_taken"
      | "invalid_credentials"
      | "weak_password"
      | "email_not_confirmed"
      | "rate_limited"
      | "not_configured"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

async function setLocalCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieSettings());
}

export async function signUpWithPassword(
  emailInput: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName?.trim() || undefined },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      if (/already registered|user already exists/i.test(error.message)) {
        throw new AuthServiceError("email_taken", "This email is already registered");
      }
      if (/password/i.test(error.message)) {
        throw new AuthServiceError("weak_password", "The password does not meet the requirements");
      }
      throw new AuthServiceError("unknown", "Could not create the account");
    }
    if (!data.session) {
      return {
        requiresEmailConfirmation: true,
        message: "Check your email to confirm the account before signing in.",
      };
    }
    return {
      user: {
        id: data.user?.id ?? "",
        email,
        displayName: displayName?.trim() || undefined,
        provider: "supabase",
      },
    };
  }

  if (!isLocalBackendAllowed()) {
    throw new AuthServiceError("not_configured", "Authentication is not configured");
  }

  try {
    const user = await createLocalUser(email, password, displayName);
    const { token } = await createLocalSession(user.id);
    await setLocalCookie(token);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, provider: "local" },
    };
  } catch (error) {
    if (error instanceof LocalAuthError) {
      if (error.code === "email_taken") {
        throw new AuthServiceError("email_taken", "This email is already registered");
      }
      throw new AuthServiceError("weak_password", error.message);
    }
    throw error;
  }
}

export async function signInWithPassword(
  emailInput: string,
  password: string,
): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        throw new AuthServiceError("email_not_confirmed", "Confirm your email before signing in");
      }
      if (/rate limit|too many/i.test(error.message)) {
        throw new AuthServiceError("rate_limited", "Too many attempts; try again later");
      }
      throw new AuthServiceError("invalid_credentials", "Email or password is incorrect");
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        displayName:
          typeof data.user.user_metadata?.display_name === "string"
            ? data.user.user_metadata.display_name
            : undefined,
        provider: "supabase",
      },
    };
  }

  if (!isLocalBackendAllowed()) {
    throw new AuthServiceError("not_configured", "Authentication is not configured");
  }

  const { verifyLocalCredentials } = await import("./local-auth");
  const user = await verifyLocalCredentials(email, password);
  if (!user) throw new AuthServiceError("invalid_credentials", "Email or password is incorrect");
  const { token } = await createLocalSession(user.id);
  await setLocalCookie(token);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, provider: "local" },
  };
}

export async function signOutCurrentUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      /* Clearing the local cookie is still required. */
    }
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith("sb-")) cookieStore.delete(cookie.name);
    }
    return;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  await deleteLocalSession(token);
  cookieStore.delete(SESSION_COOKIE);
}

export async function deleteAccountCompletely(user: AuthUser): Promise<void> {
  if (isSupabaseConfigured()) {
    // Deleting an auth user requires the service role. Check config first so we
    // never delete data and then fail to remove the account.
    createSupabaseAdminClient();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new ConfigError("The account could not be deleted by the authentication service.");
    }
    return;
  }
  if (!isLocalBackendAllowed()) throw new ConfigError("Local account deletion is disabled");
  await deleteLocalUser(user.id);
}

export async function currentLocalUserFromCookie() {
  if (!isLocalBackendAllowed()) return null;
  const cookieStore = await cookies();
  return getLocalSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
}
