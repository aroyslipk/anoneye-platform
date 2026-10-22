import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { profileSettingsSchema } from "@/lib/api/validation";
import { getRepository, requireApiUser } from "@/lib/auth/session";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(request, "settings-profile", 30, 60, user.id);
    const body = await readJsonBody(request, profileSettingsSchema, 4 * 1024);
    const repo = getRepository();
    const profile = await repo.updateUserProfile(user.id, {
      displayName: body.displayName === null ? "" : body.displayName,
      locale: body.locale,
      theme: body.theme,
    });
    return apiJson({ ok: true, profile });
  } catch (error) {
    return apiError(error);
  }
}
