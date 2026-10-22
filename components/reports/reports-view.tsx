"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, Info, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { ObservationChart } from "@/components/reports/observation-chart";
import { useDateFormat, useI18n, useNumberFormat } from "@/lib/i18n/context";
import type { ReportData } from "@/lib/services/reports";

export interface ReportProfileOption {
  id: string;
  platform: "instagram" | "facebook";
  identifier: string;
  label?: string;
}

function ChangeBadge({ from, to, absolute, percent }: { from?: number; to?: number; absolute?: number; percent?: number }) {
  const { t } = useI18n();
  const number = useNumberFormat();
  if (typeof from !== "number" || typeof to !== "number" || typeof absolute !== "number") {
    return <span className="text-xs text-ink-3">{t.reports.notEnough}</span>;
  }
  const tone = absolute > 0 ? "ok" : absolute < 0 ? "bad" : "neutral";
  const sign = absolute > 0 ? "+" : "";
  return (
    <Badge tone={tone}>
      {sign}{number.format(absolute)}
      {typeof percent === "number" ? ` (${sign}${number.format(Math.round(percent * 10) / 10)}${t.reports.percentSuffix})` : ""}
    </Badge>
  );
}

export function ReportsView({
  profiles,
  report,
  selectedId,
  from,
  to,
  rangeError,
  maxDate,
}: {
  profiles: ReportProfileOption[];
  report: ReportData | null;
  selectedId: string;
  from: string;
  to: string;
  rangeError?: string;
  maxDate: string;
}) {
  const { t } = useI18n();
  const number = useNumberFormat();
  const dateOnly = useDateFormat({ dateStyle: "medium" });
  const dateTime = useDateFormat();

  return (
    <div className="shell py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">{t.reports.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{t.reports.subtitle}</p>
        </div>
        {report ? (
          <a
            href={`/api/reports/export?tracked=${encodeURIComponent(report.tracked.id)}&from=${report.range.fromDate}&to=${report.range.toDate}`}
            className={buttonClass({ size: "sm" })}
            download
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t.reports.csv}
          </a>
        ) : null}
      </div>

      {profiles.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<FileSpreadsheet aria-hidden="true" />}
            title={t.reports.emptyTitle}
            body={t.reports.emptyBody}
            action={<Link href="/dashboard/tracked" className={buttonClass({ size: "sm" })}>{t.reports.emptyCta}</Link>}
          />
        </div>
      ) : (
        <>
          <form action="/dashboard/reports" method="get" className="mt-5 rounded-card-lg border border-line bg-paper-2 p-4 shadow-card">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
              <Field id="tracked" label={t.reports.selectProfile}>
                <Select id="tracked" name="tracked" defaultValue={selectedId} className="min-h-11">
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      @{profile.identifier}{profile.label ? ` · ${profile.label}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="from" label={t.reports.from}>
                <Input id="from" name="from" type="date" defaultValue={from} max={maxDate} />
              </Field>
              <Field id="to" label={t.reports.to}>
                <Input id="to" name="to" type="date" defaultValue={to} max={maxDate} />
              </Field>
              <button type="submit" className={buttonClass({ size: "md", className: "mb-0.5" })}>{t.reports.apply}</button>
            </div>
            <p className="mt-2 text-[0.6875rem] text-ink-3">{t.reports.csvHint}</p>
          </form>

          {rangeError ? (
            <div className="mt-4">
              <Alert tone="bad" title={t.reports.rangeError}>{rangeError}</Alert>
            </div>
          ) : null}

          {report ? (
            <div className="mt-5 space-y-4">
              {report.demoData ? (
                <Alert tone="warn" title={t.demo.badge}>{t.reports.demoNote}</Alert>
              ) : null}

              <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">@{report.tracked.identifier}</h2>
                    <p className="text-xs text-ink-3">
                      {dateOnly.format(new Date(report.range.fromIso))} – {dateOnly.format(new Date(report.range.toIsoExclusive))} ·{" "}
                      {report.range.days} · {t.reports.generatedAt}: {dateTime.format(new Date(report.generatedAt))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{t.reports.rowCount.replace("{count}", number.format(report.rowCount))}</Badge>
                    <Badge tone="neutral">
                      {t.reports.coverage}: {number.format(report.coverage.observedDays)}/{number.format(report.coverage.totalDays)}
                    </Badge>
                    {report.latestObservedAt ? (
                      <Badge tone="ok">{t.profile.lastSuccessfulUpdate}: {dateOnly.format(new Date(report.latestObservedAt))}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {([
                    ["followers", t.profile.followers],
                    ["following", t.profile.following],
                    ["mediaCount", t.profile.mediaCount],
                  ] as const).map(([key, label]) => {
                    const change = report.change[key];
                    return (
                      <div key={key} className="rounded-xl border border-line bg-paper px-3.5 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-3">{label}</p>
                          <span className="text-[0.625rem] text-ink-3">{t.reports.observations}: {number.format(change.observations)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-baseline gap-2">
                          <p className="text-xl font-semibold tabular-nums text-ink">
                            {typeof change.to === "number" ? number.format(change.to) : "—"}
                          </p>
                          <ChangeBadge from={change.from} to={change.to} absolute={change.absolute} percent={change.percent} />
                        </div>
                        <p className="mt-1 text-[0.625rem] text-ink-3">
                          {t.reports.changeFrom
                            .replace("{from}", typeof change.from === "number" ? number.format(change.from) : "—")
                            .replace("{to}", typeof change.to === "number" ? number.format(change.to) : "—")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <ObservationChart
                    points={report.series.map((point) => ({ observedAt: point.observedAt, value: point.followers }))}
                    label={t.reports.chartTitle}
                    emptyMessage={t.reports.noHistoryBody}
                    showTable
                  />
                </div>
                <p className="mt-2 flex items-start gap-2 text-[0.6875rem] leading-relaxed text-ink-3">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t.reports.missingLegend} · {t.reports.coverageHint
                    .replace("{observed}", String(report.coverage.observedDays))
                    .replace("{total}", String(report.coverage.totalDays))}
                </p>
              </section>

              <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-ink">{t.reports.daily}</h2>
                <div className="scroll-x mt-3 rounded-xl border border-line">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="bg-paper-3/70 text-[0.625rem] uppercase tracking-wide text-ink-3">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-start font-medium">{t.reports.date}</th>
                        <th scope="col" className="px-3 py-2 text-end font-medium">{t.profile.followers}</th>
                        <th scope="col" className="px-3 py-2 text-end font-medium">{t.profile.following}</th>
                        <th scope="col" className="px-3 py-2 text-end font-medium">{t.profile.mediaCount}</th>
                        <th scope="col" className="px-3 py-2 text-end font-medium">{t.reports.observations}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((day) => (
                        <tr key={day.date} className="border-t border-line/60">
                          <td className="px-3 py-1.5 text-ink-2">{dateOnly.format(new Date(`${day.date}T00:00:00.000Z`))}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums">{typeof day.followers === "number" ? number.format(day.followers) : "—"}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums">{typeof day.following === "number" ? number.format(day.following) : "—"}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums">{typeof day.mediaCount === "number" ? number.format(day.mediaCount) : "—"}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums text-ink-3">{day.observed ? number.format(day.observations) : t.reports.missing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-ink">{t.reports.weekly}</h2>
                  {report.weekly.length === 0 ? (
                    <p className="mt-3 text-xs text-ink-3">{t.reports.noHistoryBody}</p>
                  ) : (
                    <div className="scroll-x mt-3 rounded-xl border border-line">
                      <table className="w-full min-w-[420px] text-xs">
                        <thead className="bg-paper-3/70 text-[0.625rem] uppercase tracking-wide text-ink-3">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-start font-medium">{t.reports.week}</th>
                            <th scope="col" className="px-3 py-2 text-end font-medium">{t.profile.followers}</th>
                            <th scope="col" className="px-3 py-2 text-end font-medium">{t.reports.posts}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.weekly.map((week) => (
                            <tr key={week.weekStart} className="border-t border-line/60">
                              <td className="px-3 py-1.5 text-ink-2">{dateOnly.format(new Date(`${week.weekStart}T00:00:00.000Z`))}</td>
                              <td className="px-3 py-1.5 text-end tabular-nums">{typeof week.followers === "number" ? number.format(week.followers) : "—"}</td>
                              <td className="px-3 py-1.5 text-end tabular-nums text-ink-3">{number.format(week.posts)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-ink">{t.reports.topPosts}</h2>
                  {report.topPosts.length === 0 ? (
                    <p className="mt-3 text-xs text-ink-3">{t.reports.noMedia}</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line">
                      {report.topPosts.map((post) => (
                        <li key={post.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-ink-2">{post.caption ?? post.id}</p>
                            <p className="text-[0.625rem] text-ink-3">
                              {post.publishedAt ? dateOnly.format(new Date(post.publishedAt)) : "—"} ·{" "}
                              {t.reports.engagement}: {typeof post.engagement === "number" ? number.format(post.engagement) : "—"}
                            </p>
                          </div>
                          {post.permalink ? (
                            <a href={post.permalink} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 text-accent hover:underline">
                              {t.common.open}
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-ink">{t.reports.dataSource}</h2>
                <ul className="mt-2 space-y-1.5">
                  {report.dataNotes.map((note) => (
                    <li key={note} className="flex gap-2 text-xs leading-relaxed text-ink-2">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                      {(t.reportNotes as Record<string, string | undefined>)[note] ?? note}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-3 text-[0.625rem] text-ink-3">{t.reports.historyStarts}</p>
              </section>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-line-2 px-4 py-10 text-center text-sm text-ink-3">
              {t.reports.profilePicker}
            </div>
          )}
        </>
      )}
    </div>
  );
}
