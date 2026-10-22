import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/security/request";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { syncTrackedProfile } from "@/lib/services/sync";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    enforceRateLimit(request, "tracked-sync", 8, 60, user.id);
    const repo = getRepository();
    const tracked = await repo.getTracked(user.id, id);
    if (!tracked) throw new NotFoundError("Tracked profile not found");

    const result = await syncTrackedProfile({ user, repo, tracked });
    const refreshed = await repo.getTracked(user.id, tracked.id);
    if (result.result.kind !== "ok") {
      return apiJson({
        ok: false,
        jobStatus: result.job.status,
        result: result.result,
        tracked: refreshed,
      });
    }
    return apiJson({
      ok: true,
      jobStatus: result.job.status,
      snapshotCreated: result.snapshotCreated,
      result: result.result,
      tracked: refreshed,
    });
  } catch (error) {
    return apiError(error);
  }
}
