import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabase } from "@/lib/env";

/**
 * Request-scoped Supabase client using the publishable key and the signed-in
 * user's cookies. RLS is enforced for every query made with this client.
 */
export async function createSupabaseServerClient() {
  const { url, key } = requireSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session and writes the rotated cookies on the response instead.
        }
      },
    },
  });
}
