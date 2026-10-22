import "server-only";
import { ValidationError, NotFoundError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/session";
import type { MediaItemRecord, MetricSnapshot, Repository, TrackedProfile } from "@/lib/db/types";
import {
  addDays,
  eachUtcDay,
  eachUtcWeek,
  formatDateOnly,
  parseDateOnly,
  startOfUtcDay,
  startOfUtcWeek,
  todayUtc,
} from "@/lib/utils/dates";

export const MAX_REPORT_DAYS = 366;

export interface ReportRange {
  fromDate: string;
  toDate: string;
  fromIso: string;
  toIsoExclusive: string;
  days: number;
}

export interface MetricValues {
  followers?: number;
  following?: number;
  mediaCount?: number;
}

export interface DaySummary extends MetricValues {
  date: string;
  observations: number;
  observed: boolean;
  firstObservedAt?: string;
  lastObservedAt?: string;
  change?: MetricValues;
}

export interface WeekSummary extends MetricValues {
  weekStart: string;
  weekEnd: string;
  observations: number;
  observed: boolean;
  firstObservedAt?: string;
  lastObservedAt?: string;
  change?: MetricValues;
  posts: number;
}

export interface MetricChange {
  from?: number;
  to?: number;
  absolute?: number;
  percent?: number;
  observations: number;
}

export interface ReportData {
  range: ReportRange;
  tracked: TrackedProfile;
  generatedAt: string;
  snapshots: MetricSnapshot[];
  series: { observedAt: string; followers?: number; following?: number; mediaCount?: number }[];
  daily: DaySummary[];
  weekly: WeekSummary[];
  change: { followers: MetricChange; following: MetricChange; mediaCount: MetricChange };
  coverage: { observedDays: number; missingDays: number; totalDays: number };
  media: MediaItemRecord[];
  publicationFrequency: { weekStart: string; posts: number }[];
  topPosts: {
    id: string;
    caption?: string;
    publishedAt?: string;
    likeCount?: number;
    commentsCount?: number;
    engagement?: number;
    permalink?: string;
  }[];
  latestObservedAt?: string;
  dataNotes: string[];
  demoData: boolean;
  rowCount: number;
}

export function resolveReportRange(fromRaw?: string, toRaw?: string): ReportRange {
  const today = todayUtc();
  const defaultFrom = formatDateOnly(addDays(new Date(`${today}T00:00:00.000Z`), -29));

  const fromDate = fromRaw?.trim() || defaultFrom;
  const toDate = toRaw?.trim() || today;
  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);
  if (!from || !to) throw new ValidationError("Dates must be valid YYYY-MM-DD values");
  if (from > to) throw new ValidationError("The start date must be before the end date");

  const days = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days > MAX_REPORT_DAYS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_REPORT_DAYS} days`);
  }
  return {
    fromDate,
    toDate,
    fromIso: `${fromDate}T00:00:00.000Z`,
    toIsoExclusive: `${formatDateOnly(addDays(to, 1))}T00:00:00.000Z`,
    days,
  };
}

function latestMetric(
  snapshots: MetricSnapshot[],
  key: keyof MetricValues,
): number | undefined {
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const value = snapshots[index][key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

function deltaValues(first: MetricSnapshot | undefined, last: MetricSnapshot | undefined): MetricValues | undefined {
  if (!first || !last || first.id === last.id) return undefined;
  const change: MetricValues = {};
  for (const key of ["followers", "following", "mediaCount"] as const) {
    const a = first[key];
    const b = last[key];
    if (typeof a === "number" && typeof b === "number") change[key] = b - a;
  }
  return Object.keys(change).length > 0 ? change : undefined;
}

function metricChange(snapshots: MetricSnapshot[], key: keyof MetricValues): MetricChange {
  const withValue = snapshots.filter((snapshot) => typeof snapshot[key] === "number");
  const from = withValue[0]?.[key];
  const to = withValue[withValue.length - 1]?.[key];
  if (withValue.length < 2 || typeof from !== "number" || typeof to !== "number") {
    return { observations: withValue.length, from, to };
  }
  const absolute = to - from;
  return {
    from,
    to,
    absolute,
    percent: from === 0 ? undefined : Number(((absolute / from) * 100).toFixed(2)),
    observations: withValue.length,
  };
}

function bucketDate(iso: string): string {
  return iso.slice(0, 10);
}

function buildDaily(snapshots: MetricSnapshot[], range: ReportRange): DaySummary[] {
  const byDate = new Map<string, MetricSnapshot[]>();
  for (const snapshot of snapshots) {
    const date = bucketDate(snapshot.observedAt);
    const list = byDate.get(date) ?? [];
    list.push(snapshot);
    byDate.set(date, list);
  }
  const start = new Date(range.fromIso);
  const end = new Date(range.toIsoExclusive);
  return eachUtcDay(start, end).map((day) => {
    const date = formatDateOnly(day);
    const items = byDate.get(date) ?? [];
    if (items.length === 0) {
      return { date, observations: 0, observed: false };
    }
    return {
      date,
      observations: items.length,
      observed: true,
      followers: latestMetric(items, "followers"),
      following: latestMetric(items, "following"),
      mediaCount: latestMetric(items, "mediaCount"),
      firstObservedAt: items[0].observedAt,
      lastObservedAt: items[items.length - 1].observedAt,
      change: deltaValues(items[0], items[items.length - 1]),
    };
  });
}

function buildWeekly(
  snapshots: MetricSnapshot[],
  media: MediaItemRecord[],
  range: ReportRange,
): WeekSummary[] {
  const byWeek = new Map<string, MetricSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = formatDateOnly(startOfUtcWeek(new Date(snapshot.observedAt)));
    const list = byWeek.get(key) ?? [];
    list.push(snapshot);
    byWeek.set(key, list);
  }
  const postsByWeek = new Map<string, number>();
  for (const item of media) {
    if (!item.publishedAt) continue;
    const published = new Date(item.publishedAt);
    if (Number.isNaN(published.getTime())) continue;
    const key = formatDateOnly(startOfUtcWeek(published));
    postsByWeek.set(key, (postsByWeek.get(key) ?? 0) + 1);
  }

  const start = new Date(range.fromIso);
  const end = new Date(range.toIsoExclusive);
  return eachUtcWeek(start, end).map((week) => {
    const weekStart = formatDateOnly(week);
    const weekEnd = formatDateOnly(addDays(week, 6));
    const items = byWeek.get(weekStart) ?? [];
    const summary: WeekSummary = {
      weekStart,
      weekEnd,
      observations: items.length,
      observed: items.length > 0,
      posts: postsByWeek.get(weekStart) ?? 0,
    };
    if (items.length > 0) {
      summary.followers = latestMetric(items, "followers");
      summary.following = latestMetric(items, "following");
      summary.mediaCount = latestMetric(items, "mediaCount");
      summary.firstObservedAt = items[0].observedAt;
      summary.lastObservedAt = items[items.length - 1].observedAt;
      summary.change = deltaValues(items[0], items[items.length - 1]);
    }
    return summary;
  });
}

export async function buildReport(options: {
  user: AuthUser;
  repo: Repository;
  trackedId: string;
  range: ReportRange;
}): Promise<ReportData> {
  const tracked = await options.repo.getTracked(options.user.id, options.trackedId);
  if (!tracked) throw new NotFoundError("Tracked profile not found");

  const snapshots = await options.repo.listSnapshots(options.user.id, tracked.id, {
    from: options.range.fromIso,
    to: options.range.toIsoExclusive,
    limit: 5000,
  });
  const media = await options.repo.listMedia(options.user.id, tracked.id, 60);

  const daily = buildDaily(snapshots, options.range);
  const weekly = buildWeekly(snapshots, media, options.range);
  const observedDays = daily.filter((day) => day.observed).length;
  const demoData = snapshots.some((snapshot) => /demo/i.test(snapshot.source));

  const mediaNotes: string[] = [];
  if (media.length >= 24) mediaNotes.push("media-list-limited");

  const totalLikes = media.reduce((sum, item) => sum + (item.likeCount ?? 0), 0);
  const likesAvailable = media.some((item) => typeof item.likeCount === "number");
  const commentsAvailable = media.some((item) => typeof item.commentsCount === "number");

  const topPosts = media
    .map((item) => ({
      id: item.id,
      caption: item.caption,
      publishedAt: item.publishedAt,
      likeCount: item.likeCount,
      commentsCount: item.commentsCount,
      engagement:
        typeof item.likeCount === "number" && typeof item.commentsCount === "number"
          ? item.likeCount + item.commentsCount
          : undefined,
      permalink: item.permalink,
    }))
    .sort((a, b) => (b.engagement ?? b.likeCount ?? -1) - (a.engagement ?? a.likeCount ?? -1))
    .slice(0, 8);

  const dataNotes = [
    "history-starts-at-first-sync",
    ...mediaNotes,
    "engagement-is-current-state",
  ];
  if (!likesAvailable && media.length > 0) dataNotes.push("likes-missing");
  if (!commentsAvailable && media.length > 0) dataNotes.push("comments-missing");
  if (totalLikes === 0 && media.length > 0) dataNotes.push("zero-engagement-is-genuine-zero");
  if (demoData) dataNotes.push("demo-fixture-history");

  return {
    range: options.range,
    tracked,
    generatedAt: new Date().toISOString(),
    snapshots,
    series: snapshots.map((snapshot) => ({
      observedAt: snapshot.observedAt,
      followers: snapshot.followers,
      following: snapshot.following,
      mediaCount: snapshot.mediaCount,
    })),
    daily,
    weekly,
    change: {
      followers: metricChange(snapshots, "followers"),
      following: metricChange(snapshots, "following"),
      mediaCount: metricChange(snapshots, "mediaCount"),
    },
    coverage: {
      observedDays,
      missingDays: options.range.days - observedDays,
      totalDays: options.range.days,
    },
    media,
    publicationFrequency: weekly.map((week) => ({ weekStart: week.weekStart, posts: week.posts })),
    topPosts,
    latestObservedAt: snapshots.length > 0 ? snapshots[snapshots.length - 1].observedAt : undefined,
    dataNotes,
    demoData,
    rowCount: snapshots.length,
  };
}

function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  let text = String(value);
  // CSV formula injection: spreadsheets may execute cells beginning with these.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** RFC 4180 CSV; missing values are blank, genuine zero is "0". */
export function buildCsv(report: ReportData): string {
  const header = [
    "observed_at",
    "date_utc",
    "platform",
    "identifier",
    "label",
    "followers",
    "following",
    "media_count",
    "source",
    "sync_job_id",
    "sync_status",
  ];
  const lines = [header.join(",")];
  for (const snapshot of report.snapshots) {
    lines.push(
      [
        snapshot.observedAt,
        bucketDate(snapshot.observedAt),
        report.tracked.platform,
        report.tracked.identifier,
        report.tracked.label,
        snapshot.followers,
        snapshot.following,
        snapshot.mediaCount,
        snapshot.source,
        snapshot.syncJobId,
        snapshot.syncStatus,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function reportFileName(report: ReportData): string {
  const safeIdentifier = report.tracked.identifier.replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
  return `anoneye-${report.tracked.platform}-${safeIdentifier}-${report.range.fromDate}_${report.range.toDate}.csv`;
}

export function isWithinRange(iso: string, range: ReportRange): boolean {
  return iso >= range.fromIso && iso < range.toIsoExclusive;
}

export { startOfUtcDay };
