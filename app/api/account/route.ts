import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { accountDeleteSchema } from "@/lib/api/validation";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { deleteAccountCompletely, signOutCurrentUser } from "@/lib/auth/service";
import { logger } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(request, "account-delete", 4, 60, user.id);
    const body = await readJsonBody(request, accountDeleteSchema, 2 * 1024);

    if (body.mode === "account") {
      // Deletes the auth identity; foreign keys cascade app rows in Supabase.
      await deleteAccountCompletely(user);
      logger.info("account_deleted", { userId: user.id });
    } else {
      const repo = getRepository();
      await repo.deleteUserData(user.id);
      logger.info("account_data_deleted", { userId: user.id });
    }
    await signOutCurrentUser().catch(() => undefined);
    return apiJson({ ok: true, mode: body.mode });
  } catch (error) {
    return apiError(error);
  }
}
