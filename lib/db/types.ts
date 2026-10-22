import type { Platform } from "@/lib/providers/types";

/**
 * Domain records shared by the local SQLite repository and the Supabase
 * repository. Metrics are optional (undefined) rather than defaulted to zero:
 * the UI must be able to distinguish "not returned by the provider" from a
 * genuine 0.
 */

export type MonitoringStatus = "active" | "paused";
export type SyncJobStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "retry_scheduled"
  | "failed_permanent";

export type MediaType = "image" | "video" | "carousel" | "unknown";
export type RetrievalStatus = "listed" | "unavailable" | "expired";

export interface UserRecord {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName?: string;
  locale: "bn" | "en";
  theme: "light" | "dark" | "system";
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedAccount {
  id: string;
  ownerId: string;
  platform: Platform;
  providerAccountId: string;
  displayName?: string;
  status: "connected" | "expired" | "revoked";
  grantedScopes: string[];
  tokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewConnectedAccount {
  ownerId: string;
  platform: Platform;
  providerAccountId: string;
  displayName?: string;
  grantedScopes: string[];
  tokenCiphertext: string;
  tokenExpiresAt?: string;
}

export interface LatestMetrics {
  followers?: number;
  following?: number;
  mediaCount?: number;
  observedAt: string;
  source: string;
}

export interface TrackedProfile {
  id: string;
  ownerId: string;
  platform: Platform;
  identifier: string;
  canonicalUrl: string;
  label?: string;
  monitoringStatus: MonitoringStatus;
  lastSyncedAt?: string;
  lastSyncStatus?: SyncJobStatus;
  lastErrorCode?: string;
  latest?: LatestMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface NewTrackedProfile {
  ownerId: string;
  platform: Platform;
  identifier: string;
  canonicalUrl: string;
  label?: string;
}

export interface MetricSnapshot {
  id: string;
  ownerId: string;
  trackedProfileId: string;
  observedAt: string;
  followers?: number;
  following?: number;
  mediaCount?: number;
  source: string;
  syncJobId?: string;
  syncStatus: "success";
}

export interface NewMetricSnapshot {
  ownerId: string;
  trackedProfileId: string;
  observedAt: string;
  followers?: number;
  following?: number;
  mediaCount?: number;
  source: string;
  syncJobId?: string;
}

export interface SyncJob {
  id: string;
  ownerId: string;
  trackedProfileId: string;
  status: SyncJobStatus;
  startedAt: string;
  completedAt?: string;
  retryCount: number;
  nextAttemptAt?: string;
  errorCode?: string;
  safeError?: string;
}

export interface MediaItemRecord {
  id: string;
  ownerId: string;
  trackedProfileId: string;
  providerMediaId: string;
  mediaType: MediaType;
  publishedAt?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  caption?: string;
  likeCount?: number;
  commentsCount?: number;
  retrievalStatus: RetrievalStatus;
  fetchedAt: string;
}

export interface NewMediaItem {
  providerMediaId: string;
  mediaType: MediaType;
  publishedAt?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  caption?: string;
  likeCount?: number;
  commentsCount?: number;
  retrievalStatus: RetrievalStatus;
}

export interface ReportRun {
  id: string;
  ownerId: string;
  trackedProfileId?: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  rowCount: number;
  format: "csv";
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface DashboardStats {
  trackedCount: number;
  successfulSyncs7d: number;
  reportsCount: number;
  errors7d: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentProfiles: TrackedProfile[];
  recentSyncs: SyncJob[];
  latestReports: ReportRun[];
  recentErrors: SyncJob[];
  observationPoints: { observedAt: string; followers?: number }[];
}

export interface ListTrackedOptions {
  query?: string;
  status?: MonitoringStatus | "all";
  limit?: number;
  offset?: number;
}

export interface SnapshotRange {
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * Repository contract. Every method that touches user data takes the acting
 * user id and applies it in the query, so ownership is enforced below the UI
 * as well as by RLS in Supabase.
 */
export interface Repository {
  readonly kind: "local" | "supabase";
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, "displayName" | "locale" | "theme">>,
  ): Promise<UserProfile>;
  ensureUserProfile(userId: string, email?: string): Promise<UserProfile>;

  listConnectedAccounts(userId: string, platform?: Platform): Promise<ConnectedAccount[]>;
  findConnectedAccount(userId: string, platform: Platform): Promise<ConnectedAccount | null>;
  saveConnectedAccount(input: NewConnectedAccount): Promise<ConnectedAccount>;
  deleteConnectedAccount(userId: string, id: string): Promise<void>;
  getConnectedAccountToken(userId: string, id: string): Promise<string | null>;
  markConnectedAccountStatus(
    userId: string,
    id: string,
    status: ConnectedAccount["status"],
  ): Promise<void>;

  countTracked(userId: string): Promise<number>;
  listTracked(userId: string, options?: ListTrackedOptions): Promise<TrackedProfile[]>;
  getTracked(userId: string, id: string): Promise<TrackedProfile | null>;
  findTracked(
    userId: string,
    platform: Platform,
    identifier: string,
  ): Promise<TrackedProfile | null>;
  createTracked(input: NewTrackedProfile): Promise<TrackedProfile>;
  updateTracked(
    userId: string,
    id: string,
    updates: {
      label?: string | null;
      monitoringStatus?: MonitoringStatus;
      lastSyncedAt?: string | null;
      lastSyncStatus?: SyncJobStatus | null;
      lastErrorCode?: string | null;
    },
  ): Promise<TrackedProfile>;
  deleteTracked(userId: string, id: string): Promise<void>;
  listDueTracked(limit: number): Promise<TrackedProfile[]>;
  /** Privileged: used only by the cron worker (ownership is carried by the record). */
  getTrackedForSync(id: string): Promise<TrackedProfile | null>;
  /** Privileged: retry jobs whose backoff has elapsed. */
  listDueRetryJobs(limit: number): Promise<{ job: SyncJob; tracked: TrackedProfile }[]>;

  insertSnapshot(input: NewMetricSnapshot): Promise<MetricSnapshot>;
  listSnapshots(userId: string, trackedProfileId: string, range?: SnapshotRange): Promise<MetricSnapshot[]>;

  insertSyncJob(input: {
    ownerId: string;
    trackedProfileId: string;
    status: SyncJobStatus;
    startedAt: string;
  }): Promise<SyncJob>;
  updateSyncJob(
    ownerId: string,
    id: string,
    updates: {
      status?: SyncJobStatus;
      completedAt?: string | null;
      retryCount?: number;
      nextAttemptAt?: string | null;
      errorCode?: string | null;
      safeError?: string | null;
    },
  ): Promise<void>;
  listSyncJobs(
    userId: string,
    options?: { limit?: number; trackedProfileId?: string; statuses?: SyncJobStatus[] },
  ): Promise<SyncJob[]>;

  replaceMedia(
    userId: string,
    trackedProfileId: string,
    items: NewMediaItem[],
  ): Promise<void>;
  listMedia(userId: string, trackedProfileId: string, limit?: number): Promise<MediaItemRecord[]>;

  createReport(input: Omit<ReportRun, "id" | "generatedAt">): Promise<ReportRun>;
  listReports(userId: string, limit?: number): Promise<ReportRun[]>;

  getDashboard(userId: string): Promise<DashboardData>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;

  insertContactMessage(input: Omit<ContactMessage, "id" | "createdAt">): Promise<void>;
}
