import "server-only";
import { AppError, ConflictError, ConfigError, NotFoundError, RateLimitError, ValidationError } from "@/lib/errors";
import { logger, describeError } from "@/lib/logger";
import { lookupPublicProfile } from "./lookup";
import { parseProfileInput } from "@/lib/providers/parse";
import { isDemoMode } from "@/lib/env";
import type { AuthUser } from "@/lib/auth/session";
import type {
  NewMediaItem,
  Repository,
  SyncJob,
  TrackedProfile,
} from "@/lib/db/types";
import type { Platform, ProviderResult, PublicProfile } from "@/lib/providers/types";

export const MAX_TRACKED_PROFILES = 25;
export const MAX_SYNC_RETRIES = 3;
const RUNNING_WINDOW_MS = 2 * 60 * 1000;
const BASE_BACKOFF_SECONDS = 300;

type ProviderFailure = Exclude<ProviderResult<PublicProfile>, { kind: "ok" }>;

export interface SyncResult {
  job: SyncJob;
  result: ProviderResult<PublicProfile>;
  snapshotCreated: boolean;
}

/** Pure retry policy, exported for unit tests. */
export function computeRetryDelaySeconds(retryCount: number, rateLimitRetryAfter?: number): number {
  if (rateLimitRetryAfter && Number.isFinite(rateLimitRetryAfter)) {
    return Math.min(Math.max(Math.ceil(rateLimitRetryAfter), 30), 3600);
  }
  return Math.min(BASE_BACKOFF_SECONDS * 2 ** Math.max(retryCount - 1, 0), 3600);
}

function isPermanent(failure: ProviderFailure): boolean {
  return ["unauthorized", "not-configured", "not-found", "unsupported", "invalid-input"].includes(failure.kind);
}

function failureCode(failure: ProviderFailure): string {
  switch (failure.kind) {
    case "invalid-input":
      return "invalid_input";
    case "not-configured":
      return "not_configured";
    case "unauthorized":
      return "provider_unauthorized";
    case "rate-limited":
      return "provider_rate_limited";
    case "not-found":
      return "profile_not_found";
    case "unavailable":
      return "provider_unavailable";
    case "unsupported":
      return "unsupported";
  }
}

export function failureToAppError(failure: ProviderFailure): AppError {
  switch (failure.kind) {
    case "invalid-input":
      return new ValidationError("The profile identifier is invalid");
    case "not-configured":
      return new ConfigError("Live social-platform access is not configured", {
        missing: failure.missing,
      });
    case "unauthorized":
      return new AppError("forbidden", 403, "The connected account is not authorised for this lookup", {
        publicDetails: { reason: "provider_unauthorized", source: failure.source },
      });
    case "rate-limited":
      return new RateLimitError(failure.retryAfterSeconds ?? 60);
    case "not-found":
      return new NotFoundError("No public profile matched this identifier");
    case "unavailable":
      return new AppError("upstream_unavailable", 502, "The social platform did not respond");
    case "unsupported":
      return new AppError("unsupported", 501, "This operation is not supported by the official API");
  }
}

function hasMetrics(profile: PublicProfile): boolean {
  return Object.values(profile.metrics).some((value) => typeof value === "number");
}

function mediaRows(profile: PublicProfile): NewMediaItem[] {
  return profile.media.map((item) => ({
    providerMediaId: item.id,
    mediaType: item.type,
    publishedAt: item.timestamp,
    sourceUrl: item.mediaUrl,
    thumbnailUrl: item.thumbnailUrl,
    permalink: item.permalink,
    caption: item.caption,
    likeCount: item.likeCount,
    commentsCount: item.commentsCount,
    retrievalStatus: item.retrievalStatus,
  }));
}

function trackedObservedAt(profile: PublicProfile): string {
  const parsed = Date.parse(profile.fetchedAt);
  const now = Date.now();
  if (!Number.isFinite(parsed) || parsed > now + 5 * 60 * 1000) return new Date(now).toISOString();
  return new Date(parsed).toISOString();
}

/**
 * Run one sync attempt. A snapshot is written only when the provider returned
 * at least one genuine metric value. Nothing is back-filled or estimated.
 */
export async function syncTrackedProfile(options: {
  user: AuthUser;
  repo: Repository;
  tracked: TrackedProfile;
  existingJob?: SyncJob;
  signal?: AbortSignal;
}): Promise<SyncResult> {
  const { user, repo, tracked } = options;

  if (!options.existingJob) {
    const recentJobs = await repo.listSyncJobs(user.id, {
      trackedProfileId: tracked.id,
      statuses: ["running"],
      limit: 5,
    });
    const active = recentJobs.find(
      (job) => Date.now() - Date.parse(job.startedAt) < RUNNING_WINDOW_MS,
    );
    if (active) {
      throw new ConflictError("A sync for this profile is already running");
    }
    // A manual refresh supersedes any queued retry; otherwise cron would run a
    // second sync for the same profile later.
    const pending = await repo.listSyncJobs(user.id, {
      trackedProfileId: tracked.id,
      statuses: ["retry_scheduled"],
      limit: 10,
    });
    for (const job of pending) {
      await repo.updateSyncJob(user.id, job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        safeError: "superseded_by_new_sync",
      });
    }
  }

  const job =
    options.existingJob ??
    (await repo.insertSyncJob({
      ownerId: user.id,
      trackedProfileId: tracked.id,
      status: "running",
      startedAt: new Date().toISOString(),
    }));
  if (options.existingJob) {
    await repo.updateSyncJob(user.id, job.id, { status: "running" });
  }

  const lookup = await lookupPublicProfile({
    platform: tracked.platform,
    rawInput: tracked.identifier,
    user,
    repo,
    signal: options.signal,
  });

  if (!lookup.result || lookup.result.kind !== "ok") {
    const failure: ProviderFailure =
      lookup.result ?? { kind: "unavailable", source: "unknown" };
    return finaliseFailure(repo, user, tracked, job, failure);
  }

  const profile = lookup.result.data;
  const observedAt = trackedObservedAt(profile);
  const hasGenuineMetrics = hasMetrics(profile);

  let snapshotCreated = false;
  if (hasGenuineMetrics) {
    await repo.insertSnapshot({
      ownerId: user.id,
      trackedProfileId: tracked.id,
      observedAt,
      followers: profile.metrics.followers,
      following: profile.metrics.following,
      mediaCount: profile.metrics.mediaCount,
      source: profile.source,
      syncJobId: job.id,
    });
    snapshotCreated = true;
  } else {
    logger.info("sync_without_metrics", { trackedProfileId: tracked.id });
  }

  const keepExistingMedia = profile.limitations.includes("page-posts-need-approval");
  if (!keepExistingMedia) {
    await repo.replaceMedia(
      user.id,
      tracked.id,
      mediaRows(profile).map((item) => ({
        ...item,
        // Demo fixture images are local assets; live Meta media URLs are
        // displayed directly and never proxied by the backend.
        retrievalStatus: item.retrievalStatus,
      })),
    );
  }

  const completedAt = new Date().toISOString();
  await repo.updateSyncJob(user.id, job.id, {
    status: "succeeded",
    completedAt,
    nextAttemptAt: null,
    errorCode: null,
    safeError: null,
  });
  await repo.updateTracked(user.id, tracked.id, {
    lastSyncedAt: completedAt,
    lastSyncStatus: "succeeded",
    lastErrorCode: null,
  });

  return {
    job: { ...job, status: "succeeded", completedAt },
    result: lookup.result,
    snapshotCreated,
  };
}

async function finaliseFailure(
  repo: Repository,
  user: AuthUser,
  tracked: TrackedProfile,
  job: SyncJob,
  failure: ProviderFailure,
): Promise<SyncResult> {
  const permanent = isPermanent(failure);
  const retryCount = job.retryCount + 1;
  const completedAt = new Date().toISOString();

  let status: SyncJob["status"];
  let nextAttemptAt: string | undefined;
  if (permanent) {
    status = "failed_permanent";
  } else if (retryCount >= MAX_SYNC_RETRIES) {
    status = "failed_permanent";
  } else {
    status = "retry_scheduled";
    const delay = computeRetryDelaySeconds(
      retryCount,
      failure.kind === "rate-limited" ? failure.retryAfterSeconds : undefined,
    );
    nextAttemptAt = new Date(Date.now() + delay * 1000).toISOString();
  }

  const code = failureCode(failure);
  await repo.updateSyncJob(user.id, job.id, {
    status,
    completedAt: status === "retry_scheduled" ? undefined : completedAt,
    retryCount,
    nextAttemptAt,
    errorCode: code,
    safeError: code,
  });
  await repo.updateTracked(user.id, tracked.id, {
    lastSyncStatus: status,
    lastErrorCode: code,
  });

  logger.warn("sync_failed", {
    trackedProfileId: tracked.id,
    status,
    code,
    retryCount,
  });

  return {
    job: { ...job, status, completedAt, retryCount, nextAttemptAt, errorCode: code, safeError: code },
    result: failure,
    snapshotCreated: false,
  };
}

export async function saveTrackedProfile(options: {
  user: AuthUser;
  repo: Repository;
  platform: Platform;
  rawInput: string;
  label?: string;
}): Promise<{ tracked: TrackedProfile; sync: SyncResult }> {
  const parsed = parseProfileInput(options.platform, options.rawInput);
  if (!parsed.ok) throw new ValidationError("The profile identifier is invalid");

  const count = await options.repo.countTracked(options.user.id);
  if (count >= MAX_TRACKED_PROFILES) {
    throw new ConflictError("Tracked-profile limit reached");
  }
  const existing = await options.repo.findTracked(
    options.user.id,
    options.platform,
    parsed.value.identifier,
  );
  if (existing) throw new ConflictError("This profile is already tracked");

  const label = options.label?.trim().slice(0, 80) || undefined;
  const tracked = await options.repo.createTracked({
    ownerId: options.user.id,
    platform: options.platform,
    identifier: parsed.value.identifier,
    canonicalUrl: parsed.value.canonicalUrl,
    label,
  });

  try {
    const sync = await syncTrackedProfile({ user: options.user, repo: options.repo, tracked });
    if (sync.result.kind !== "ok") {
      // Do not keep a tracked profile we could not read: that would imply
      // monitoring that is not actually happening.
      await options.repo.deleteTracked(options.user.id, tracked.id);
      throw failureToAppError(sync.result);
    }
    const refreshed = await options.repo.getTracked(options.user.id, tracked.id);
    return { tracked: refreshed ?? tracked, sync };
  } catch (error) {
    if (error instanceof AppError) throw error;
    await options.repo.deleteTracked(options.user.id, tracked.id).catch(() => undefined);
    logger.error("tracked_profile_save_failed", { error: describeError(error) });
    throw error;
  }
}

export interface ScheduledSyncSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: { trackedProfileId: string; status: string }[];
}

/**
 * Worker entry point used by the protected cron route. It processes queued
 * retries first, then profiles that have never synced or are older than 12h.
 * Capped to stay within provider rate limits.
 */
export async function runScheduledSync(repo: Repository, limit = 10): Promise<ScheduledSyncSummary> {
  const summary: ScheduledSyncSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };
  const seen = new Set<string>();
  const retries = await repo.listDueRetryJobs(limit);
  for (const { job, tracked } of retries.slice(0, limit)) {
    if (seen.has(tracked.id)) continue;
    seen.add(tracked.id);
    summary.attempted += 1;
    try {
      const result = await syncTrackedProfile({
        user: { id: tracked.ownerId, email: "", provider: "local" },
        repo,
        tracked,
        existingJob: job,
      });
      if (result.result.kind === "ok") summary.succeeded += 1;
      else summary.failed += 1;
      summary.results.push({ trackedProfileId: tracked.id, status: result.job.status });
    } catch (error) {
      summary.failed += 1;
      summary.results.push({ trackedProfileId: tracked.id, status: "error" });
      logger.error("scheduled_retry_failed", { trackedProfileId: tracked.id, error: describeError(error) });
    }
  }

  const remaining = Math.max(limit - summary.attempted, 0);
  if (remaining > 0) {
    const due = await repo.listDueTracked(remaining + seen.size);
    for (const tracked of due) {
      if (summary.attempted >= limit) break;
      if (seen.has(tracked.id)) continue;
      const owner = { id: tracked.ownerId, email: "", provider: "local" as const };
      const latest = await repo.listSyncJobs(tracked.ownerId, {
        trackedProfileId: tracked.id,
        limit: 1,
      });
      const pending = latest[0];
      if (
        pending &&
        pending.status === "retry_scheduled" &&
        pending.nextAttemptAt &&
        Date.parse(pending.nextAttemptAt) > Date.now()
      ) {
        summary.skipped += 1;
        continue;
      }
      seen.add(tracked.id);
      summary.attempted += 1;
      try {
        const result = await syncTrackedProfile({ user: owner, repo, tracked });
        if (result.result.kind === "ok") summary.succeeded += 1;
        else summary.failed += 1;
        summary.results.push({ trackedProfileId: tracked.id, status: result.job.status });
      } catch (error) {
        summary.failed += 1;
        summary.results.push({ trackedProfileId: tracked.id, status: "error" });
        logger.error("scheduled_sync_failed", { trackedProfileId: tracked.id, error: describeError(error) });
      }
    }
  }
  return summary;
}

export async function seedDemoHistory(options: {
  user: AuthUser;
  repo: Repository;
  tracked: TrackedProfile;
}): Promise<number> {
  const tracked = options.tracked;
  if (!isDemoMode() || !tracked.identifier.endsWith(".demo")) {
    throw new ValidationError("Demo history is only available in demo mode");
  }
  // Idempotent: re-running the seed must not duplicate history.
  const recent = await options.repo.listSnapshots(options.user.id, tracked.id, {
    from: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 50,
  });
  if (recent.some((snapshot) => /demo seed/i.test(snapshot.source))) return 0;

  const baseFollowers = tracked.platform === "instagram" ? 12480 : 8420;
  let inserted = 0;
  for (let days = 14; days >= 1; days -= 1) {
    const observedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const drift = Math.round((14 - days) * 7 + Math.sin(days) * 18);
    await options.repo.insertSnapshot({
      ownerId: options.user.id,
      trackedProfileId: tracked.id,
      observedAt,
      followers: baseFollowers - 120 + drift,
      following: tracked.platform === "instagram" ? 318 : undefined,
      mediaCount: tracked.platform === "instagram" ? 92 + Math.floor((14 - days) / 5) : undefined,
      source: "Anoneye demo seed — synthetic history, not an observation",
    });
    inserted += 1;
  }
  return inserted;
}
