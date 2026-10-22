import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/security/request";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { seedDemoHistory } from "@/lib/services/sync";

/** Explicitly labelled synthetic history for the enabled demo environment only. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    enforceRateLimit(request, "demo-history", 4, 60, user.id);
    const repo = getRepository();
    const tracked = await repo.getTracked(user.id, id);
    if (!tracked) throw new NotFoundError("Tracked profile not found");
    const inserted = await seedDemoHistory({ user, repo, tracked });
    return apiJson({ ok: true, inserted });
  } catch (error) {
    return apiError(error);
  }
}
