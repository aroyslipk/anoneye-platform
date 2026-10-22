import { connection, NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestOrigin, safeNextPath } from "@/lib/security/request";
import { logger } from "@/lib/logger";

/**
 * Supabase email-confirmation / PKCE callback. Set this exact URL in the
 * Supabase Auth redirect allow-list: {site}/auth/callback
 */
export async function GET(request: NextRequest) {
  await connection();
  const origin = requestOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/dashboard");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=not_configured", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  const supabase = await createSupabaseServerClient();
  try {
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } else if (tokenHash && type) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "email" | "recovery" | "invite",
      });
      if (verifyError) throw verifyError;
    } else {
      return NextResponse.redirect(new URL("/login?error=callback", origin));
    }
  } catch (callbackError) {
    logger.warn("auth_callback_failed", {
      message: callbackError instanceof Error ? callbackError.message : "unknown",
    });
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
