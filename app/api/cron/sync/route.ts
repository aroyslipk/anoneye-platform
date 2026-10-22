import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/handler";
import { getEnv } from "@/lib/env";
import { ConfigError, UnauthorizedError } from "@/lib/errors";
import { getPrivilegedRepository } from "@/lib/auth/session";
import { runScheduledSync } from "@/lib/services/sync";
import { logger, describeError } from "@/lib/logger";

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/**
 * Scheduler entry point. Configure CRON_SECRET (>= 16 chars) and call with
 * `Authorization: Bearer $CRON_SECRET`. See docs/DEPLOYMENT.md.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = getEnv().CRON_SECRET;
    if (!secret || secret.length < 16) throw new ConfigError("CRON_SECRET is not configured");
    if (!authorized(request, secret)) throw new UnauthorizedError();

    const repo = getPrivilegedRepository();
    const summary = await runScheduledSync(repo, 10);
    logger.info("cron_sync_completed", {
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
      skipped: summary.skipped,
    });
    return apiJson({ ok: true, summary });
  } catch (error) {
    logger.warn("cron_sync_failed", { error: describeError(error) });
    return apiError(error);
  }
}
