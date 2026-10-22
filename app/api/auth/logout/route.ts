import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/security/request";
import { signOutCurrentUser } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "auth-logout", 30, 60);
    await signOutCurrentUser();
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
