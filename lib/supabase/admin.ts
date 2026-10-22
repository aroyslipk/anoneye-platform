import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv, requireSupabase } from "@/lib/env";
import { ConfigError } from "@/lib/errors";

/**
 * Service-role client. Only used for operations that cannot be expressed with
 * user-scoped RLS: reading the encrypted connected-account secret and
 * cross-user scheduled sync. Never import this from client code, never return
 * its results directly, and never log its errors with request details.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabase();
  const serviceKey = getEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new ConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is required for connected-account credentials and scheduled syncs.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getEnv().SUPABASE_SERVICE_ROLE_KEY);
}
