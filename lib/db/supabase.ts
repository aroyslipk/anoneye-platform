import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ConflictError, ConfigError } from "@/lib/errors";
import { logger, describeError } from "@/lib/logger";
import type {
  ConnectedAccount,
  ContactMessage,
  DashboardData,
  ListTrackedOptions,
  MediaItemRecord,
  MetricSnapshot,
  NewConnectedAccount,
  NewMediaItem,
  NewMetricSnapshot,
  NewTrackedProfile,
  ReportRun,
  Repository,
  SnapshotRange,
  SyncJob,
  SyncJobStatus,
  TrackedProfile,
  UserProfile,
} from "./types";
import type { Platform } from "@/lib/providers/types";

/**
 * Supabase/Postgres repository.
 *
 * User-facing calls use the user's JWT so RLS decides access. Only the ops
 * that RLS cannot express — reading encrypted OAuth secrets, cross-user cron
 * selection, and contact messages — use the service role.
 */

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function optNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function scopes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function mapProfile(row: Row): UserProfile {
  return {
    userId: str(row.user_id),
    displayName: optStr(row.display_name),
    locale: row.locale === "en" ? "en" : "bn",
    theme: row.theme === "dark" ? "dark" : row.theme === "light" ? "light" : "system",
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapAccount(row: Row): ConnectedAccount {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    platform: row.platform === "facebook" ? "facebook" : "instagram",
    providerAccountId: str(row.provider_account_id),
    displayName: optStr(row.display_name),
    status:
      row.status === "expired" ? "expired" : row.status === "revoked" ? "revoked" : "connected",
    grantedScopes: scopes(row.granted_scopes),
    tokenExpiresAt: optStr(row.token_expires_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapTracked(row: Row): TrackedProfile {
  const observedAt = optStr(row.latest_observed_at);
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    platform: row.platform === "facebook" ? "facebook" : "instagram",
    identifier: str(row.identifier),
    canonicalUrl: str(row.canonical_url),
    label: optStr(row.label),
    monitoringStatus: row.monitoring_status === "paused" ? "paused" : "active",
    lastSyncedAt: optStr(row.last_synced_at),
    lastSyncStatus: optStr(row.last_sync_status) as TrackedProfile["lastSyncStatus"],
    lastErrorCode: optStr(row.last_error_code),
    latest: observedAt
      ? {
          followers: optNum(row.latest_followers),
          following: optNum(row.latest_following),
          mediaCount: optNum(row.latest_media_count),
          observedAt,
          source: str(row.latest_source),
        }
      : undefined,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapSnapshot(row: Row): MetricSnapshot {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    trackedProfileId: str(row.tracked_profile_id),
    observedAt: str(row.observed_at),
    followers: optNum(row.followers_count),
    following: optNum(row.following_count),
    mediaCount: optNum(row.media_count),
    source: str(row.source),
    syncJobId: optStr(row.sync_job_id),
    syncStatus: "success",
  };
}

function mapSyncJob(row: Row): SyncJob {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    trackedProfileId: str(row.tracked_profile_id),
    status: str(row.status) as SyncJobStatus,
    startedAt: str(row.started_at),
    completedAt: optStr(row.completed_at),
    retryCount: optNum(row.retry_count) ?? 0,
    nextAttemptAt: optStr(row.next_attempt_at),
    errorCode: optStr(row.error_code),
    safeError: optStr(row.safe_error),
  };
}

function mapMedia(row: Row): MediaItemRecord {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    trackedProfileId: str(row.tracked_profile_id),
    providerMediaId: str(row.provider_media_id),
    mediaType:
      row.media_type === "image" || row.media_type === "video" || row.media_type === "carousel"
        ? row.media_type
        : "unknown",
    publishedAt: optStr(row.published_at),
    sourceUrl: optStr(row.source_url),
    thumbnailUrl: optStr(row.thumbnail_url),
    permalink: optStr(row.permalink),
    caption: optStr(row.caption),
    likeCount: optNum(row.like_count),
    commentsCount: optNum(row.comments_count),
    retrievalStatus:
      row.retrieval_status === "expired"
        ? "expired"
        : row.retrieval_status === "unavailable"
          ? "unavailable"
          : "listed",
    fetchedAt: str(row.fetched_at),
  };
}

function mapReport(row: Row): ReportRun {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    trackedProfileId: optStr(row.tracked_profile_id),
    periodStart: str(row.period_start),
    periodEnd: str(row.period_end),
    generatedAt: str(row.generated_at),
    rowCount: optNum(row.row_count) ?? 0,
    format: "csv",
  };
}

function safeQueryError(operation: string, error: unknown) {
  logger.error("supabase_query_failed", { operation, error: describeError(error) });
}

function searchTerm(query: string): string {
  // PostgREST filter strings are parsed server-side; strip syntax characters
  // before embedding the term in an `or` expression.
  return query
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._\s-]/g, "")
    .trim();
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;

  /**
   * @param privileged use the service role for cron work that spans users.
   * Every method still takes and applies the owner id explicitly.
   */
  constructor(private readonly privileged = false) {}

  private async sb() {
    return this.privileged ? createSupabaseAdminClient() : createSupabaseServerClient();
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, locale, theme, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      safeQueryError("profiles.select", error);
      throw new Error("Could not load profile settings");
    }
    return data ? mapProfile(data as Row) : null;
  }

  async ensureUserProfile(userId: string): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) return existing;
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId }, { onConflict: "user_id" })
      .select("user_id, display_name, locale, theme, created_at, updated_at")
      .single();
    if (error || !data) {
      safeQueryError("profiles.upsert", error);
      throw new Error("Could not create profile settings");
    }
    return mapProfile(data as Row);
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, "displayName" | "locale" | "theme">>,
  ): Promise<UserProfile> {
    await this.ensureUserProfile(userId);
    const patch: Row = {};
    if (updates.displayName !== undefined) patch.display_name = updates.displayName.trim() || null;
    if (updates.locale !== undefined) patch.locale = updates.locale;
    if (updates.theme !== undefined) patch.theme = updates.theme;
    if (Object.keys(patch).length === 0) {
      const profile = await this.getUserProfile(userId);
      if (!profile) throw new Error("Profile not found");
      return profile;
    }
    patch.updated_at = new Date().toISOString();
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("user_id, display_name, locale, theme, created_at, updated_at")
      .single();
    if (error || !data) {
      safeQueryError("profiles.update", error);
      throw new Error("Could not update profile settings");
    }
    return mapProfile(data as Row);
  }

  async listConnectedAccounts(userId: string, platform?: Platform): Promise<ConnectedAccount[]> {
    const supabase = await this.sb();
    let query = supabase.from("connected_accounts").select("*").eq("owner_id", userId);
    if (platform) query = query.eq("platform", platform);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      safeQueryError("connected_accounts.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapAccount(row as Row));
  }

  async findConnectedAccount(userId: string, platform: Platform): Promise<ConnectedAccount | null> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("owner_id", userId)
      .eq("platform", platform)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      safeQueryError("connected_accounts.find", error);
      return null;
    }
    return data ? mapAccount(data as Row) : null;
  }

  async saveConnectedAccount(input: NewConnectedAccount): Promise<ConnectedAccount> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("connected_accounts")
      .upsert(
        {
          owner_id: input.ownerId,
          platform: input.platform,
          provider_account_id: input.providerAccountId,
          display_name: input.displayName ?? null,
          status: "connected",
          granted_scopes: input.grantedScopes,
          token_expires_at: input.tokenExpiresAt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,platform,provider_account_id" },
      )
      .select("*")
      .single();
    if (error || !data) {
      safeQueryError("connected_accounts.upsert", error);
      throw new Error("Could not store connected account");
    }
    const account = mapAccount(data as Row);
    const admin = createSupabaseAdminClient();
    const { error: secretError } = await admin.from("connected_account_secrets").upsert(
      {
        account_id: account.id,
        ciphertext: input.tokenCiphertext,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (secretError) {
      safeQueryError("connected_account_secrets.upsert", secretError);
      throw new ConfigError(
        "The connected account was saved but its credential could not be stored securely.",
      );
    }
    return account;
  }

  async deleteConnectedAccount(userId: string, id: string): Promise<void> {
    const supabase = await this.sb();
    const { error } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);
    if (error) {
      safeQueryError("connected_accounts.delete", error);
      throw new Error("Could not remove connected account");
    }
  }

  async getConnectedAccountToken(userId: string, id: string): Promise<string | null> {
    // Verify ownership with the user-scoped client before using the service role.
    const supabase = await this.sb();
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .eq("status", "connected")
      .maybeSingle();
    if (!account) return null;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("connected_account_secrets")
      .select("ciphertext")
      .eq("account_id", id)
      .maybeSingle();
    if (error) {
      safeQueryError("connected_account_secrets.select", error);
      return null;
    }
    return data ? str((data as Row).ciphertext) || null : null;
  }

  async markConnectedAccountStatus(
    userId: string,
    id: string,
    status: ConnectedAccount["status"],
  ): Promise<void> {
    const supabase = await this.sb();
    const { error } = await supabase
      .from("connected_accounts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", userId);
    if (error) safeQueryError("connected_accounts.status", error);
  }

  async countTracked(userId: string): Promise<number> {
    const supabase = await this.sb();
    const { count, error } = await supabase
      .from("tracked_profiles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    if (error) {
      safeQueryError("tracked_profiles.count", error);
      return 0;
    }
    return count ?? 0;
  }

  async listTracked(userId: string, options: ListTrackedOptions = {}): Promise<TrackedProfile[]> {
    const supabase = await this.sb();
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    let query = supabase
      .from("tracked_profiles_latest")
      .select("*")
      .eq("owner_id", userId)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (options.status && options.status !== "all") {
      query = query.eq("monitoring_status", options.status);
    }
    const term = options.query ? searchTerm(options.query) : "";
    if (term) query = query.or(`identifier.ilike.%${term}%,label.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) {
      safeQueryError("tracked_profiles_latest.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapTracked(row as Row));
  }

  async getTracked(userId: string, id: string): Promise<TrackedProfile | null> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("tracked_profiles_latest")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) {
      safeQueryError("tracked_profiles_latest.get", error);
      return null;
    }
    return data ? mapTracked(data as Row) : null;
  }

  async findTracked(userId: string, platform: Platform, identifier: string): Promise<TrackedProfile | null> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("tracked_profiles_latest")
      .select("*")
      .eq("owner_id", userId)
      .eq("platform", platform)
      .eq("identifier", identifier)
      .maybeSingle();
    if (error) {
      safeQueryError("tracked_profiles_latest.find", error);
      return null;
    }
    return data ? mapTracked(data as Row) : null;
  }

  async createTracked(input: NewTrackedProfile): Promise<TrackedProfile> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("tracked_profiles")
      .insert({
        owner_id: input.ownerId,
        platform: input.platform,
        identifier: input.identifier,
        canonical_url: input.canonicalUrl,
        label: input.label ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        throw new ConflictError("This profile is already tracked");
      }
      safeQueryError("tracked_profiles.insert", error);
      throw new Error("Could not save tracked profile");
    }
    const created = await this.getTracked(input.ownerId, str((data as Row).id));
    if (!created) throw new Error("Could not reload tracked profile");
    return created;
  }

  async updateTracked(
    userId: string,
    id: string,
    updates: {
      label?: string | null;
      monitoringStatus?: TrackedProfile["monitoringStatus"];
      lastSyncedAt?: string | null;
      lastSyncStatus?: TrackedProfile["lastSyncStatus"] | null;
      lastErrorCode?: string | null;
    },
  ): Promise<TrackedProfile> {
    const patch: Row = {};
    if (updates.label !== undefined) patch.label = updates.label || null;
    if (updates.monitoringStatus !== undefined) patch.monitoring_status = updates.monitoringStatus;
    if (updates.lastSyncedAt !== undefined) patch.last_synced_at = updates.lastSyncedAt;
    if (updates.lastSyncStatus !== undefined) patch.last_sync_status = updates.lastSyncStatus;
    if (updates.lastErrorCode !== undefined) patch.last_error_code = updates.lastErrorCode;
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const supabase = await this.sb();
      const { error } = await supabase
        .from("tracked_profiles")
        .update(patch)
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) {
        safeQueryError("tracked_profiles.update", error);
        throw new Error("Could not update tracked profile");
      }
    }
    const updated = await this.getTracked(userId, id);
    if (!updated) throw new Error("Tracked profile not found");
    return updated;
  }

  async deleteTracked(userId: string, id: string): Promise<void> {
    const supabase = await this.sb();
    const { error } = await supabase
      .from("tracked_profiles")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);
    if (error) {
      safeQueryError("tracked_profiles.delete", error);
      throw new Error("Could not remove tracked profile");
    }
  }

  async getTrackedForSync(id: string): Promise<TrackedProfile | null> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("tracked_profiles_latest")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      safeQueryError("tracked_profiles_latest.cron_get", error);
      return null;
    }
    return data ? mapTracked(data as Row) : null;
  }

  async listDueRetryJobs(limit: number): Promise<{ job: SyncJob; tracked: TrackedProfile }[]> {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("sync_jobs")
      .select("*")
      .eq("status", "retry_scheduled")
      .lte("next_attempt_at", now)
      .order("next_attempt_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error) {
      safeQueryError("sync_jobs.retry_due", error);
      return [];
    }
    const out: { job: SyncJob; tracked: TrackedProfile }[] = [];
    for (const row of data ?? []) {
      const job = mapSyncJob(row as Row);
      const tracked = await this.getTrackedForSync(job.trackedProfileId);
      if (tracked) out.push({ job, tracked });
    }
    return out;
  }

  async listDueTracked(limit: number): Promise<TrackedProfile[]> {
    const admin = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("tracked_profiles_latest")
      .select("*")
      .eq("monitoring_status", "active")
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) {
      safeQueryError("tracked_profiles_latest.due", error);
      return [];
    }
    return (data ?? []).map((row) => mapTracked(row as Row));
  }

  async insertSnapshot(input: NewMetricSnapshot): Promise<MetricSnapshot> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("metric_snapshots")
      .insert({
        owner_id: input.ownerId,
        tracked_profile_id: input.trackedProfileId,
        observed_at: input.observedAt,
        followers_count: input.followers ?? null,
        following_count: input.following ?? null,
        media_count: input.mediaCount ?? null,
        source: input.source,
        sync_job_id: input.syncJobId ?? null,
        sync_status: "success",
      })
      .select("*")
      .single();
    if (error || !data) {
      safeQueryError("metric_snapshots.insert", error);
      throw new Error("Could not store observation");
    }
    return mapSnapshot(data as Row);
  }

  async listSnapshots(
    userId: string,
    trackedProfileId: string,
    range: SnapshotRange = {},
  ): Promise<MetricSnapshot[]> {
    const supabase = await this.sb();
    let query = supabase
      .from("metric_snapshots")
      .select("*")
      .eq("owner_id", userId)
      .eq("tracked_profile_id", trackedProfileId)
      .order("observed_at", { ascending: true })
      .limit(Math.min(Math.max(range.limit ?? 1000, 1), 5000));
    if (range.from) query = query.gte("observed_at", range.from);
    if (range.to) query = query.lt("observed_at", range.to);
    const { data, error } = await query;
    if (error) {
      safeQueryError("metric_snapshots.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapSnapshot(row as Row));
  }

  async insertSyncJob(input: {
    ownerId: string;
    trackedProfileId: string;
    status: SyncJobStatus;
    startedAt: string;
  }): Promise<SyncJob> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("sync_jobs")
      .insert({
        owner_id: input.ownerId,
        tracked_profile_id: input.trackedProfileId,
        status: input.status,
        started_at: input.startedAt,
      })
      .select("*")
      .single();
    if (error || !data) {
      safeQueryError("sync_jobs.insert", error);
      throw new Error("Could not start sync job");
    }
    return mapSyncJob(data as Row);
  }

  async updateSyncJob(
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
  ): Promise<void> {
    const patch: Row = {};
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt;
    if (updates.retryCount !== undefined) patch.retry_count = updates.retryCount;
    if (updates.nextAttemptAt !== undefined) patch.next_attempt_at = updates.nextAttemptAt;
    if (updates.errorCode !== undefined) patch.error_code = updates.errorCode;
    if (updates.safeError !== undefined) patch.safe_error = updates.safeError;
    if (Object.keys(patch).length === 0) return;
    const supabase = await this.sb();
    const { error } = await supabase
      .from("sync_jobs")
      .update(patch)
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) safeQueryError("sync_jobs.update", error);
  }

  async listSyncJobs(
    userId: string,
    options: { limit?: number; trackedProfileId?: string; statuses?: SyncJobStatus[] } = {},
  ): Promise<SyncJob[]> {
    const supabase = await this.sb();
    let query = supabase
      .from("sync_jobs")
      .select("*")
      .eq("owner_id", userId)
      .order("started_at", { ascending: false })
      .limit(Math.min(Math.max(options.limit ?? 20, 1), 100));
    if (options.trackedProfileId) query = query.eq("tracked_profile_id", options.trackedProfileId);
    if (options.statuses?.length) query = query.in("status", options.statuses);
    const { data, error } = await query;
    if (error) {
      safeQueryError("sync_jobs.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapSyncJob(row as Row));
  }

  async replaceMedia(userId: string, trackedProfileId: string, items: NewMediaItem[]): Promise<void> {
    const supabase = await this.sb();
    const { data: existing, error: existingError } = await supabase
      .from("media_items")
      .select("provider_media_id")
      .eq("owner_id", userId)
      .eq("tracked_profile_id", trackedProfileId);
    if (existingError) {
      safeQueryError("media_items.select_existing", existingError);
      return;
    }
    const keep = new Set(items.slice(0, 60).map((item) => item.providerMediaId));
    const stale = (existing ?? [])
      .map((row) => str((row as Row).provider_media_id))
      .filter((id) => id && !keep.has(id));
    if (stale.length > 0) {
      const { error } = await supabase
        .from("media_items")
        .delete()
        .eq("owner_id", userId)
        .eq("tracked_profile_id", trackedProfileId)
        .in("provider_media_id", stale);
      if (error) safeQueryError("media_items.delete_stale", error);
    }
    if (items.length === 0) return;
    const fetchedAt = new Date().toISOString();
    const rows = items.slice(0, 60).map((item) => ({
      owner_id: userId,
      tracked_profile_id: trackedProfileId,
      provider_media_id: item.providerMediaId.slice(0, 200),
      media_type: item.mediaType,
      published_at: item.publishedAt ?? null,
      source_url: item.sourceUrl ?? null,
      thumbnail_url: item.thumbnailUrl ?? null,
      permalink: item.permalink ?? null,
      caption: item.caption?.slice(0, 2200) ?? null,
      like_count: item.likeCount ?? null,
      comments_count: item.commentsCount ?? null,
      retrieval_status: item.retrievalStatus,
      fetched_at: fetchedAt,
    }));
    const { error } = await supabase
      .from("media_items")
      .upsert(rows, { onConflict: "tracked_profile_id,provider_media_id" });
    if (error) safeQueryError("media_items.upsert", error);
  }

  async listMedia(userId: string, trackedProfileId: string, limit = 24): Promise<MediaItemRecord[]> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .eq("owner_id", userId)
      .eq("tracked_profile_id", trackedProfileId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(Math.max(limit, 1), 60));
    if (error) {
      safeQueryError("media_items.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapMedia(row as Row));
  }

  async createReport(input: Omit<ReportRun, "id" | "generatedAt">): Promise<ReportRun> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("reports")
      .insert({
        owner_id: input.ownerId,
        tracked_profile_id: input.trackedProfileId ?? null,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        row_count: input.rowCount,
        format: "csv",
      })
      .select("*")
      .single();
    if (error || !data) {
      safeQueryError("reports.insert", error);
      throw new Error("Could not record report run");
    }
    return mapReport(data as Row);
  }

  async listReports(userId: string, limit = 10): Promise<ReportRun[]> {
    const supabase = await this.sb();
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("owner_id", userId)
      .order("generated_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error) {
      safeQueryError("reports.select", error);
      return [];
    }
    return (data ?? []).map((row) => mapReport(row as Row));
  }

  async getDashboard(userId: string): Promise<DashboardData> {
    const supabase = await this.sb();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [trackedCount, syncs, reports, errors, recentProfiles, recentSyncs, latestReports, points] =
      await Promise.all([
        supabase
          .from("tracked_profiles")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId),
        supabase
          .from("sync_jobs")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("status", "succeeded")
          .gte("started_at", since7d),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId),
        supabase
          .from("sync_jobs")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .in("status", ["failed", "retry_scheduled", "failed_permanent"])
          .gte("started_at", since7d),
        this.listTracked(userId, { limit: 5 }),
        this.listSyncJobs(userId, { limit: 5 }),
        this.listReports(userId, 3),
        supabase
          .from("metric_snapshots")
          .select("observed_at, followers_count")
          .eq("owner_id", userId)
          .gte("observed_at", since14d)
          .not("followers_count", "is", null)
          .order("observed_at", { ascending: true })
          .limit(500),
      ]);

    return {
      stats: {
        trackedCount: trackedCount.count ?? 0,
        successfulSyncs7d: syncs.count ?? 0,
        reportsCount: reports.count ?? 0,
        errors7d: errors.count ?? 0,
      },
      recentProfiles,
      recentSyncs,
      latestReports,
      recentErrors:
        (await this.listSyncJobs(userId, {
          limit: 5,
          statuses: ["failed", "retry_scheduled", "failed_permanent"],
        })) ?? [],
      observationPoints: (points.data ?? []).map((row) => ({
        observedAt: str((row as Row).observed_at),
        followers: optNum((row as Row).followers_count),
      })),
    };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [profile, accounts, tracked] = await Promise.all([
      this.getUserProfile(userId),
      this.listConnectedAccounts(userId),
      this.listTracked(userId, { limit: 100 }),
    ]);
    const snapshots: MetricSnapshot[] = [];
    const media: MediaItemRecord[] = [];
    for (const item of tracked) {
      snapshots.push(...(await this.listSnapshots(userId, item.id, { limit: 5000 })));
      media.push(...(await this.listMedia(userId, item.id, 60)));
    }
    return {
      exportedAt: new Date().toISOString(),
      profile,
      connectedAccounts: accounts,
      trackedProfiles: tracked,
      snapshots,
      syncJobs: await this.listSyncJobs(userId, { limit: 100 }),
      media,
      reports: await this.listReports(userId, 50),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    const supabase = await this.sb();
    for (const table of ["connected_accounts", "tracked_profiles", "reports"] as const) {
      const { error } = await supabase.from(table).delete().eq("owner_id", userId);
      if (error) {
        safeQueryError(`${table}.delete_all`, error);
        throw new Error("Could not delete all user data");
      }
    }
  }

  async insertContactMessage(input: Omit<ContactMessage, "id" | "createdAt">): Promise<void> {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("contact_messages").insert({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
    });
    if (error) {
      safeQueryError("contact_messages.insert", error);
      throw new Error("Could not store contact message");
    }
  }
}
