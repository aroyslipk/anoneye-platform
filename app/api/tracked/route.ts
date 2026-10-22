import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { trackedCreateSchema } from "@/lib/api/validation";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { saveTrackedProfile } from "@/lib/services/sync";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(request, "tracked-create", 20, 60, user.id);
    const body = await readJsonBody(request, trackedCreateSchema, 8 * 1024);
    const repo = getRepository();
    const { tracked, sync } = await saveTrackedProfile({
      user,
      repo,
      platform: body.platform,
      rawInput: body.input ?? body.identifier ?? "",
      label: body.label,
    });
    return apiJson({
      ok: true,
      tracked: {
        id: tracked.id,
        platform: tracked.platform,
        identifier: tracked.identifier,
        label: tracked.label,
        canonicalUrl: tracked.canonicalUrl,
        monitoringStatus: tracked.monitoringStatus,
        lastSyncedAt: tracked.lastSyncedAt,
        latest: tracked.latest,
      },
      sync: {
        snapshotCreated: sync.snapshotCreated,
        source: sync.result.kind === "ok" ? sync.result.source : undefined,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
