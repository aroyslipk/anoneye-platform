import { connection, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isMetaOAuthConfigured, tokenEncryptionAvailable } from "@/lib/env";
import {
  buildDialogUrl,
  oauthStartState,
  oauthStateCookieOptions,
  OAUTH_STATE_COOKIE,
} from "@/lib/services/meta-oauth";
import { logger, describeError } from "@/lib/logger";

/** Start the Meta OAuth consent flow. The user must be signed in. */
export async function GET(request: NextRequest) {
  await connection();
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=%2Fsettings", request.url));
  }

  if (!isMetaOAuthConfigured() || !tokenEncryptionAvailable()) {
    return NextResponse.redirect(new URL("/settings?oauth=not_configured", request.url));
  }

  const platform = request.nextUrl.searchParams.get("platform") === "facebook" ? "facebook" : "instagram";

  try {
    const { state, cookieValue } = oauthStartState(user, platform);
    const response = NextResponse.redirect(buildDialogUrl(state));
    response.cookies.set(OAUTH_STATE_COOKIE, cookieValue, oauthStateCookieOptions());
    return response;
  } catch (error) {
    logger.warn("oauth_start_failed", { error: describeError(error), platform });
    return NextResponse.redirect(new URL("/settings?oauth=unexpected", request.url));
  }
}
