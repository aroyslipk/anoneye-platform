import type { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/handler";
import { readJsonBody, assertSameOrigin } from "@/lib/security/request";
import { disconnectSchema } from "@/lib/api/validation";
import { enforceRateLimit } from "@/lib/api/handler";
import { getRepository, requireApiUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(request, "oauth-disconnect", 10, 60, user.id);
    const body = await readJsonBody(request, disconnectSchema, 2 * 1024);
    await getRepository().deleteConnectedAccount(user.id, body.id);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
