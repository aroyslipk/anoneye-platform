import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { trackedPatchSchema } from "@/lib/api/validation";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/errors";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    enforceRateLimit(request, "tracked-update", 30, 60, user.id);
    const body = await readJsonBody(request, trackedPatchSchema, 4 * 1024);
    const repo = getRepository();
    const tracked = await repo.getTracked(user.id, id);
    if (!tracked) throw new NotFoundError("Tracked profile not found");
    const updated = await repo.updateTracked(user.id, id, {
      monitoringStatus: body.monitoringStatus,
      label: body.label,
    });
    return apiJson({ ok: true, tracked: updated });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    enforceRateLimit(request, "tracked-delete", 30, 60, user.id);
    if (request.nextUrl.searchParams.get("confirm") !== "1") {
      throw new ValidationError("Deletion must be confirmed");
    }
    const repo = getRepository();
    const tracked = await repo.getTracked(user.id, id);
    if (!tracked) throw new NotFoundError("Tracked profile not found");
    await repo.deleteTracked(user.id, id);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
