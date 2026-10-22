import { cookies } from "next/headers";
import { connection, NextResponse, type NextRequest } from "next/server";
import { getRepository, getSessionUser } from "@/lib/auth/session";
import {
  connectMetaAccount,
  describeOAuthError,
  OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/services/meta-oauth";
import { logger } from "@/lib/logger";

function finish(request: NextRequest, query: string, clearState: boolean) {
  const response = NextResponse.redirect(new URL(`/settings?${query}`, request.url));
  if (clearState) response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  await connection();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.get("error");

  if (denied) return finish(request, "oauth=denied", true);
  if (!code || !state) return finish(request, "oauth=missing_code", true);

  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login?next=%2Fsettings", request.url));

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const verification = verifyOAuthState(cookieValue, state);
  if (!verification.ok || verification.userId !== user.id) {
    logger.warn("oauth_state_mismatch", { userId: user.id });
    return finish(request, "oauth=state_mismatch", true);
  }

  try {
    const repo = getRepository();
    const result = await connectMetaAccount({
      code,
      user,
      repo,
      platform: verification.platform,
    });
    logger.info("oauth_connected", { userId: user.id, platform: result.platform, count: result.connected });
    return finish(request, `oauth=connected&platform=${result.platform}&count=${result.connected}`, true);
  } catch (error) {
    const reason = describeOAuthError(error);
    logger.warn("oauth_callback_failed", { userId: user.id, reason });
    return finish(request, `oauth=${encodeURIComponent(reason)}`, true);
  }
}
