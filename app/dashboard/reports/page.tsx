import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser, getRepository } from "@/lib/auth/session";
import { buildReport, resolveReportRange } from "@/lib/services/reports";
import { todayUtc } from "@/lib/utils/dates";
import { ReportsView, type ReportProfileOption } from "@/components/reports/reports-view";
import { ConfigError } from "@/lib/errors";
import type { ReportData } from "@/lib/services/reports";
import type { TrackedProfile } from "@/lib/db/types";

export const instant = false;

export const metadata: Metadata = {
  title: "রিপোর্ট ও অ্যানালিটিক্স",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const user = await requireUser("/dashboard/reports");
  const params = await searchParams;

  let tracked: TrackedProfile[] = [];
  try {
    tracked = await getRepository().listTracked(user.id, { limit: 100 });
  } catch {
    tracked = [];
  }

  const options: ReportProfileOption[] = tracked.map((profile) => ({
    id: profile.id,
    platform: profile.platform,
    identifier: profile.identifier,
    label: profile.label,
  }));

  const selectedId =
    typeof params.tracked === "string" && options.some((option) => option.id === params.tracked)
      ? params.tracked
      : options[0]?.id ?? "";

  const fromParam = typeof params.from === "string" ? params.from : "";
  const toParam = typeof params.to === "string" ? params.to : "";
  const maxDate = todayUtc();

  let report: ReportData | null = null;
  let rangeError: string | undefined;
  let from = fromParam;
  let to = toParam;

  if (selectedId) {
    try {
      const range = resolveReportRange(fromParam || undefined, toParam || undefined);
      from = range.fromDate;
      to = range.toDate;
      report = await buildReport({ user, repo: getRepository(), trackedId: selectedId, range });
    } catch (error) {
      if (error instanceof ConfigError) {
        rangeError = error.message;
      } else if (error instanceof Error) {
        rangeError = error.message;
        // Fall back to the default range so the form stays usable.
        try {
          const fallback = resolveReportRange();
          from = fallback.fromDate;
          to = fallback.toDate;
        } catch {
          /* keep raw values */
        }
      }
    }
  }

  return (
    <ReportsView
      profiles={options}
      report={report}
      selectedId={selectedId}
      from={from}
      to={to}
      rangeError={rangeError}
      maxDate={maxDate}
    />
  );
}
