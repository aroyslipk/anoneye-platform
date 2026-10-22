"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleSlash,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ObservationChart } from "@/components/reports/observation-chart";
import { useDateFormat, useI18n, useNumberFormat } from "@/lib/i18n/context";
import type { DashboardData, SyncJobStatus } from "@/lib/db/types";

export interface DashboardConfig {
  backend: "supabase" | "local" | "unconfigured";
  metaOAuth: "configured" | "missing" | "invalid";
  metaServerToken: "configured" | "missing";
  demoMode: boolean;
  issues: { key: string; message: string }[];
}

function statusTone(status: SyncJobStatus): "ok" | "bad" | "warn" | "neutral" | "accent" {
  switch (status) {
    case "succeeded":
      return "ok";
    case "failed":
    case "failed_permanent":
      return "bad";
    case "retry_scheduled":
      return "warn";
    case "running":
      return "accent";
    default:
      return "neutral";
  }
}

export function DashboardView({
  user,
  data,
  config,
  trackedLimit,
}: {
  user: { email: string; displayName?: string };
  data: DashboardData;
  config: DashboardConfig;
  trackedLimit: number;
}) {
  const { t } = useI18n();
  const number = useNumberFormat();
  const dateTime = useDateFormat();
  const dateOnly = useDateFormat({ dateStyle: "medium" });
  const notConfigured = config.metaOAuth !== "configured" && config.metaServerToken !== "configured";
  const points = data.observationPoints.map((point) => ({ observedAt: point.observedAt, value: point.followers }));

  return (
    <div className="shell py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent">{t.dashboard.greeting}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">{t.dashboard.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{user.displayName || user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className={buttonClass({ variant: "secondary", size: "sm" })}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {t.dashboard.openInSearch}
          </Link>
          <Link href="/dashboard/reports" className={buttonClass({ variant: "ghost", size: "sm" })}>
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            {t.reports.title}
          </Link>
        </div>
      </div>

      {config.issues.length > 0 ? (
        <div className="mt-4">
          <Alert tone="warn" title={t.settings.configurationIssues}>
            <ul className="list-disc space-y-1 ps-4 text-xs">
              {config.issues.map((issue) => (
                <li key={issue.key}><code className="font-mono">{issue.key}</code>: {issue.message}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}

      {config.demoMode ? (
        <div className="mt-4">
          <Alert tone="info" title={t.common.demoMode}>{t.dashboard.demoNotice}</Alert>
        </div>
      ) : null}

      {notConfigured ? (
        <div className="mt-4">
          <Alert
            tone="warn"
            title={t.dashboard.setupTitle}
            actions={<Link href="/settings" className={buttonClass({ variant: "secondary", size: "sm" })}>{t.dashboard.setupCta}</Link>}
          >
            <p>{t.dashboard.setupBody}</p>
            <ol className="mt-2 list-decimal space-y-1 ps-4 text-xs">
              {t.dashboard.setupSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </Alert>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t.dashboard.kpis.tracked} value={number.format(data.stats.trackedCount)} hint={t.dashboard.kpis.trackedHint.replace("{limit}", String(trackedLimit))} icon={<Users className="h-4 w-4" aria-hidden="true" />} tone="accent" />
        <KpiCard label={t.dashboard.kpis.synced} value={number.format(data.stats.successfulSyncs7d)} icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} tone="ok" />
        <KpiCard label={t.dashboard.kpis.reports} value={number.format(data.stats.reportsCount)} icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />} />
        <KpiCard label={t.dashboard.kpis.errors} value={number.format(data.stats.errors7d)} icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />} tone={data.stats.errors7d > 0 ? "warn" : "neutral"} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5" aria-labelledby="dashboard-chart">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="dashboard-chart" className="text-sm font-semibold text-ink">{t.dashboard.chartTitle}</h2>
            <span className="text-[0.6875rem] text-ink-3">{t.dashboard.chartNote}</span>
          </div>
          <div className="mt-3">
            <ObservationChart points={points} label={t.dashboard.chartTitle} emptyMessage={t.dashboard.chartEmpty} showTable />
          </div>
        </section>

        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5" aria-labelledby="recent-profiles">
          <div className="flex items-center justify-between">
            <h2 id="recent-profiles" className="text-sm font-semibold text-ink">{t.dashboard.recentProfiles}</h2>
            <Link href="/dashboard/tracked" className="text-xs font-medium text-accent hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          {data.recentProfiles.length === 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-3">{t.dashboard.emptyProfilesBody}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.recentProfiles.slice(0, 5).map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/profile/${profile.platform}/${encodeURIComponent(profile.identifier)}`} className="block truncate text-sm font-medium text-ink hover:text-accent">
                      @{profile.identifier}
                    </Link>
                    <p className="text-[0.625rem] text-ink-3">
                      {profile.lastSyncedAt ? dateTime.format(new Date(profile.lastSyncedAt)) : t.tracked.lastSyncedNever}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-ink-2">
                    {typeof profile.latest?.followers === "number" ? number.format(profile.latest.followers) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.recentProfiles.length === 0 ? (
            <div className="mt-3">
              <Link href="/search" className={buttonClass({ variant: "soft", size: "sm" })}>{t.tracked.emptyCta}</Link>
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Activity className="h-4 w-4 text-ink-3" aria-hidden="true" />
            {t.dashboard.recentSyncs}
          </h2>
          {data.recentSyncs.length === 0 ? (
            <p className="mt-3 text-xs text-ink-3">{t.dashboard.emptySyncs}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.recentSyncs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate font-mono text-[0.6875rem] text-ink-3">{job.trackedProfileId.slice(0, 12)}…</span>
                  <Badge tone={statusTone(job.status)}>{t.dashboard.syncStatus[job.status]}</Badge>
                  <span className="shrink-0 text-[0.625rem] text-ink-3">{dateOnly.format(new Date(job.startedAt))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertTriangle className="h-4 w-4 text-warn" aria-hidden="true" />
            {t.dashboard.recentErrors}
          </h2>
          {data.recentErrors.length === 0 ? (
            <p className="mt-3 text-xs text-ink-3">{t.dashboard.emptyErrors}</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {data.recentErrors.slice(0, 4).map((job) => (
                  <li key={job.id} className="rounded-lg border border-bad/20 bg-bad-soft/40 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-[0.6875rem] text-bad">{job.errorCode ?? "error"}</code>
                      <span className="text-[0.625rem] text-ink-3">{dateTime.format(new Date(job.startedAt))}</span>
                    </div>
                    <p className="mt-1 text-[0.625rem] leading-relaxed text-ink-2">{job.safeError ?? ""}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.625rem] text-ink-3">{t.dashboard.errorsHint}</p>
            </>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FileSpreadsheet className="h-4 w-4 text-ink-3" aria-hidden="true" />
              {t.dashboard.latestReports}
            </h2>
            <Link href="/dashboard/reports" className="text-xs font-medium text-accent hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          {data.latestReports.length === 0 ? (
            <p className="mt-3 text-xs text-ink-3">{t.dashboard.emptyReports}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.latestReports.slice(0, 4).map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="text-ink-2">{dateOnly.format(new Date(report.periodStart))} – {dateOnly.format(new Date(new Date(report.periodEnd).getTime() - 86_400_000))}</span>
                  <span className="text-ink-3">{number.format(report.rowCount)}</span>
                  <Badge tone="neutral">{report.format.toUpperCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Database className="h-4 w-4 text-ink-3" aria-hidden="true" />
            {t.settings.backend}
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone={config.backend === "supabase" ? "ok" : config.backend === "local" ? "warn" : "bad"}>
              {config.backend === "supabase" ? t.dashboard.backendSupabase : config.backend === "local" ? t.dashboard.backendLocal : t.dashboard.backendUnconfigured}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            {config.backend === "local" ? t.dashboard.backendLocalBody : config.backend === "unconfigured" ? t.dashboard.backendUnconfiguredBody : t.settings.tokenNotice}
          </p>
          <Link href="/settings" className={buttonClass({ variant: "ghost", size: "sm", className: "mt-2 -ms-2" })}>
            {t.nav.settings}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {data.recentProfiles.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<BarChart3 aria-hidden="true" />}
            title={t.dashboard.emptyProfiles}
            body={t.dashboard.emptyProfilesBody}
            action={<Link href="/search" className={buttonClass({ size: "sm" })}>{t.tracked.emptyCta}</Link>}
          />
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 text-[0.625rem] text-ink-3">
          <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
          {t.reports.missingLegend}
        </p>
      )}
    </div>
  );
}
