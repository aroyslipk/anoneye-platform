import type { NextRequest } from "next/server";
import { connection, NextResponse } from "next/server";
import { apiError, enforceRateLimit } from "@/lib/api/handler";
import { getRepository, requireApiUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { buildCsv, buildReport, reportFileName, resolveReportRange } from "@/lib/services/reports";
import { logger, describeError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await requireApiUser();
    enforceRateLimit(request, "report-export", 10, 60, user.id);
    const trackedId = request.nextUrl.searchParams.get("tracked")?.trim();
    if (!trackedId) throw new ValidationError("A tracked profile must be selected");
    const range = resolveReportRange(
      request.nextUrl.searchParams.get("from") ?? undefined,
      request.nextUrl.searchParams.get("to") ?? undefined,
    );
    const repo = getRepository();
    const report = await buildReport({ user, repo, trackedId, range });
    try {
      await repo.createReport({
        ownerId: user.id,
        trackedProfileId: report.tracked.id,
        periodStart: range.fromIso,
        periodEnd: range.toIsoExclusive,
        rowCount: report.rowCount,
        format: "csv",
      });
    } catch (error) {
      // The CSV is still useful; log the failed audit row but do not fake it.
      logger.error("report_run_record_failed", { error: describeError(error) });
    }
    const csv = buildCsv(report);
    const filename = reportFileName(report);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-anoneye-missing-values": "blank cells mean no observation; 0 is a genuine zero",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
