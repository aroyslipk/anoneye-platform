import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
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
 * Local SQLite repository — a development and single-instance demo backend.
 *
 * It intentionally implements the same ownership rules as the Supabase
 * repository, so cross-user behaviour can be tested without external services.
 * It is not a production multi-tenant database: there is one file, one process,
 * and no RLS. See docs/SECURITY.md.
 */

type Row = Record<string, unknown>;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'bn' CHECK (locale IN ('bn','en')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','facebook')),
  provider_account_id TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','expired','revoked')),
  granted_scopes TEXT NOT NULL DEFAULT '[]',
  token_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, platform, provider_account_id)
);

CREATE TABLE IF NOT EXISTS connected_account_secrets (
  account_id TEXT PRIMARY KEY REFERENCES connected_accounts(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','facebook')),
  identifier TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  label TEXT,
  monitoring_status TEXT NOT NULL DEFAULT 'active' CHECK (monitoring_status IN ('active','paused')),
  last_synced_at TEXT,
  last_sync_status TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, platform, identifier)
);
CREATE INDEX IF NOT EXISTS tracked_owner_idx ON tracked_profiles(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tracked_due_idx ON tracked_profiles(monitoring_status, last_synced_at);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_profile_id TEXT NOT NULL REFERENCES tracked_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','retry_scheduled','failed_permanent')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  error_code TEXT,
  safe_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_jobs_owner_idx ON sync_jobs(owner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_jobs_tracked_idx ON sync_jobs(tracked_profile_id, started_at DESC);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_profile_id TEXT NOT NULL REFERENCES tracked_profiles(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  followers_count INTEGER,
  following_count INTEGER,
  media_count INTEGER,
  source TEXT NOT NULL,
  sync_job_id TEXT REFERENCES sync_jobs(id) ON DELETE SET NULL,
  sync_status TEXT NOT NULL DEFAULT 'success' CHECK (sync_status IN ('success')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_tracked_idx ON metric_snapshots(tracked_profile_id, observed_at);
CREATE INDEX IF NOT EXISTS snapshots_owner_idx ON metric_snapshots(owner_id, observed_at);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_profile_id TEXT NOT NULL REFERENCES tracked_profiles(id) ON DELETE CASCADE,
  provider_media_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','carousel','unknown')),
  published_at TEXT,
  source_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  caption TEXT,
  like_count INTEGER,
  comments_count INTEGER,
  retrieval_status TEXT NOT NULL CHECK (retrieval_status IN ('listed','unavailable','expired')),
  fetched_at TEXT NOT NULL,
  UNIQUE (tracked_profile_id, provider_media_id)
);
CREATE INDEX IF NOT EXISTS media_tracked_idx ON media_items(tracked_profile_id, published_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_profile_id TEXT REFERENCES tracked_profiles(id) ON DELETE SET NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv'))
);
CREATE INDEX IF NOT EXISTS reports_owner_idx ON reports(owner_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

interface DbGlobal {
  __anoneyeLocalDb?: { path: string; db: DatabaseSync };
}

function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

export function localDbPath(): string {
  const configured = getEnv().ANONEYE_LOCAL_DB_PATH;
  if (configured)
    return configured === ":memory:"
      ? configured
      : resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  if (process.env.NODE_ENV === "test") return ":memory:";
  return resolve(process.cwd(), ".data/anoneye.db");
}

export function getLocalDb(): DatabaseSync {
  const g = globalThis as unknown as DbGlobal;
  const path = localDbPath();
  if (!g.__anoneyeLocalDb || g.__anoneyeLocalDb.path !== path) {
    g.__anoneyeLocalDb = { path, db: openDatabase(path) };
  }
  return g.__anoneyeLocalDb.db;
}

export function closeLocalDbForTests(): void {
  const g = globalThis as unknown as DbGlobal;
  if (g.__anoneyeLocalDb) {
    try {
      g.__anoneyeLocalDb.db.close();
    } catch {
      /* already closed */
    }
    g.__anoneyeLocalDb = undefined;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}
function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : asString(value);
}
function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseScopes(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(asString(value));
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function mapAccount(row: Row): ConnectedAccount {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    platform: asString(row.platform) as Platform,
    providerAccountId: asString(row.provider_account_id),
    displayName: optionalString(row.display_name),
    status: asString(row.status) as ConnectedAccount["status"],
    grantedScopes: parseScopes(row.granted_scopes),
    tokenExpiresAt: optionalString(row.token_expires_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapTracked(row: Row): TrackedProfile {
  const observedAt = optionalString(row.metrics_observed_at);
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    platform: asString(row.platform) as Platform,
    identifier: asString(row.identifier),
    canonicalUrl: asString(row.canonical_url),
    label: optionalString(row.label),
    monitoringStatus: asString(row.monitoring_status) as TrackedProfile["monitoringStatus"],
    lastSyncedAt: optionalString(row.last_synced_at),
    lastSyncStatus: optionalString(row.last_sync_status) as TrackedProfile["lastSyncStatus"],
    lastErrorCode: optionalString(row.last_error_code),
    latest: observedAt
      ? {
          followers: optionalNumber(row.followers_count),
          following: optionalNumber(row.following_count),
          mediaCount: optionalNumber(row.media_count),
          observedAt,
          source: asString(row.metrics_source),
        }
      : undefined,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapSnapshot(row: Row): MetricSnapshot {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    trackedProfileId: asString(row.tracked_profile_id),
    observedAt: asString(row.observed_at),
    followers: optionalNumber(row.followers_count),
    following: optionalNumber(row.following_count),
    mediaCount: optionalNumber(row.media_count),
    source: asString(row.source),
    syncJobId: optionalString(row.sync_job_id),
    syncStatus: "success",
  };
}

function mapSyncJob(row: Row): SyncJob {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    trackedProfileId: asString(row.tracked_profile_id),
    status: asString(row.status) as SyncJobStatus,
    startedAt: asString(row.started_at),
    completedAt: optionalString(row.completed_at),
    retryCount: optionalNumber(row.retry_count) ?? 0,
    nextAttemptAt: optionalString(row.next_attempt_at),
    errorCode: optionalString(row.error_code),
    safeError: optionalString(row.safe_error),
  };
}

function mapMedia(row: Row): MediaItemRecord {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    trackedProfileId: asString(row.tracked_profile_id),
    providerMediaId: asString(row.provider_media_id),
    mediaType: asString(row.media_type) as MediaItemRecord["mediaType"],
    publishedAt: optionalString(row.published_at),
    sourceUrl: optionalString(row.source_url),
    thumbnailUrl: optionalString(row.thumbnail_url),
    permalink: optionalString(row.permalink),
    caption: optionalString(row.caption),
    likeCount: optionalNumber(row.like_count),
    commentsCount: optionalNumber(row.comments_count),
    retrievalStatus: asString(row.retrieval_status) as MediaItemRecord["retrievalStatus"],
    fetchedAt: asString(row.fetched_at),
  };
}

function mapReport(row: Row): ReportRun {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    trackedProfileId: optionalString(row.tracked_profile_id),
    periodStart: asString(row.period_start),
    periodEnd: asString(row.period_end),
    generatedAt: asString(row.generated_at),
    rowCount: optionalNumber(row.row_count) ?? 0,
    format: "csv",
  };
}

function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export class LocalRepository implements Repository {
  readonly kind = "local" as const;
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync = getLocalDb()) {
    this.db = db;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare("SELECT id, display_name, locale, theme, created_at, updated_at FROM users WHERE id = ?")
      .get(userId) as Row | undefined;
    if (!row) return null;
    return {
      userId: asString(row.id),
      displayName: optionalString(row.display_name),
      locale: asString(row.locale) as UserProfile["locale"],
      theme: asString(row.theme) as UserProfile["theme"],
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    };
  }

  async ensureUserProfile(userId: string): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) return existing;
    const timestamp = nowIso();
    this.db
      .prepare(
        "INSERT OR IGNORE INTO users (id, email, password_hash, locale, theme, created_at, updated_at) VALUES (?, ?, ?, 'bn', 'system', ?, ?)",
      )
      .run(userId, `${userId}@supabase.local`, "supabase-managed", timestamp, timestamp);
    const created = await this.getUserProfile(userId);
    if (!created) throw new Error("Failed to create local profile shell");
    return created;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, "displayName" | "locale" | "theme">>,
  ): Promise<UserProfile> {
    await this.ensureUserProfile(userId);
    const fields: string[] = [];
    const values: (string | null)[] = [];
    if (updates.displayName !== undefined) {
      fields.push("display_name = ?");
      values.push(updates.displayName.trim() || null);
    }
    if (updates.locale !== undefined) {
      fields.push("locale = ?");
      values.push(updates.locale);
    }
    if (updates.theme !== undefined) {
      fields.push("theme = ?");
      values.push(updates.theme);
    }
    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(nowIso());
      this.db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values, userId);
    }
    const profile = await this.getUserProfile(userId);
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async listConnectedAccounts(userId: string, platform?: Platform): Promise<ConnectedAccount[]> {
    const rows = platform
      ? (this.db
          .prepare("SELECT * FROM connected_accounts WHERE owner_id = ? AND platform = ? ORDER BY created_at DESC")
          .all(userId, platform) as Row[])
      : (this.db
          .prepare("SELECT * FROM connected_accounts WHERE owner_id = ? ORDER BY created_at DESC")
          .all(userId) as Row[]);
    return rows.map(mapAccount);
  }

  async findConnectedAccount(userId: string, platform: Platform): Promise<ConnectedAccount | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM connected_accounts WHERE owner_id = ? AND platform = ? AND status = 'connected' ORDER BY created_at DESC LIMIT 1",
      )
      .get(userId, platform) as Row | undefined;
    return row ? mapAccount(row) : null;
  }

  async saveConnectedAccount(input: NewConnectedAccount): Promise<ConnectedAccount> {
    const now = nowIso();
    const existing = this.db
      .prepare(
        "SELECT id FROM connected_accounts WHERE owner_id = ? AND platform = ? AND provider_account_id = ?",
      )
      .get(input.ownerId, input.platform, input.providerAccountId) as Row | undefined;
    const id = existing ? asString(existing.id) : randomUUID();
    if (existing) {
      this.db
        .prepare(
          "UPDATE connected_accounts SET display_name = ?, status = 'connected', granted_scopes = ?, token_expires_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          input.displayName ?? null,
          JSON.stringify(input.grantedScopes),
          input.tokenExpiresAt ?? null,
          now,
          id,
        );
    } else {
      this.db
        .prepare(
          "INSERT INTO connected_accounts (id, owner_id, platform, provider_account_id, display_name, status, granted_scopes, token_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?)",
        )
        .run(
          id,
          input.ownerId,
          input.platform,
          input.providerAccountId,
          input.displayName ?? null,
          JSON.stringify(input.grantedScopes),
          input.tokenExpiresAt ?? null,
          now,
          now,
        );
    }
    this.db
      .prepare(
        "INSERT INTO connected_account_secrets (account_id, ciphertext, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at",
      )
      .run(id, input.tokenCiphertext, now);
    const row = this.db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(id) as Row;
    return mapAccount(row);
  }

  async deleteConnectedAccount(userId: string, id: string): Promise<void> {
    this.db.prepare("DELETE FROM connected_accounts WHERE id = ? AND owner_id = ?").run(id, userId);
  }

  async getConnectedAccountToken(userId: string, id: string): Promise<string | null> {
    const row = this.db
      .prepare(
        "SELECT s.ciphertext FROM connected_account_secrets s JOIN connected_accounts a ON a.id = s.account_id WHERE a.id = ? AND a.owner_id = ? AND a.status = 'connected'",
      )
      .get(id, userId) as Row | undefined;
    return row ? asString(row.ciphertext) : null;
  }

  async markConnectedAccountStatus(
    userId: string,
    id: string,
    status: ConnectedAccount["status"],
  ): Promise<void> {
    this.db
      .prepare("UPDATE connected_accounts SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(status, nowIso(), id, userId);
  }

  async countTracked(userId: string): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM tracked_profiles WHERE owner_id = ?")
      .get(userId) as Row;
    return optionalNumber(row.n) ?? 0;
  }

  async listTracked(userId: string, options: ListTrackedOptions = {}): Promise<TrackedProfile[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const where = ["t.owner_id = ?"];
    const params: (string | number)[] = [userId];
    if (options.query?.trim()) {
      where.push("(t.identifier LIKE ? ESCAPE '\\' OR t.label LIKE ? ESCAPE '\\')");
      const pattern = likePattern(options.query.trim().slice(0, 80));
      params.push(pattern, pattern);
    }
    if (options.status && options.status !== "all") {
      where.push("t.monitoring_status = ?");
      params.push(options.status);
    }
    params.push(limit, offset);
    const rows = this.db
      .prepare(
        `SELECT t.*, s.followers_count, s.following_count, s.media_count,
                s.observed_at AS metrics_observed_at, s.source AS metrics_source
         FROM tracked_profiles t
         LEFT JOIN metric_snapshots s ON s.id = (
           SELECT id FROM metric_snapshots WHERE tracked_profile_id = t.id
           ORDER BY observed_at DESC, created_at DESC LIMIT 1
         )
         WHERE ${where.join(" AND ")}
         ORDER BY COALESCE(t.last_synced_at, t.created_at) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params) as Row[];
    return rows.map(mapTracked);
  }

  async getTracked(userId: string, id: string): Promise<TrackedProfile | null> {
    const row = this.db
      .prepare(
        `SELECT t.*, s.followers_count, s.following_count, s.media_count,
                s.observed_at AS metrics_observed_at, s.source AS metrics_source
         FROM tracked_profiles t
         LEFT JOIN metric_snapshots s ON s.id = (
           SELECT id FROM metric_snapshots WHERE tracked_profile_id = t.id
           ORDER BY observed_at DESC, created_at DESC LIMIT 1
         )
         WHERE t.id = ? AND t.owner_id = ?`,
      )
      .get(id, userId) as Row | undefined;
    return row ? mapTracked(row) : null;
  }

  async findTracked(userId: string, platform: Platform, identifier: string): Promise<TrackedProfile | null> {
    const row = this.db
      .prepare(
        `SELECT t.*, s.followers_count, s.following_count, s.media_count,
                s.observed_at AS metrics_observed_at, s.source AS metrics_source
         FROM tracked_profiles t
         LEFT JOIN metric_snapshots s ON s.id = (
           SELECT id FROM metric_snapshots WHERE tracked_profile_id = t.id
           ORDER BY observed_at DESC, created_at DESC LIMIT 1
         )
         WHERE t.owner_id = ? AND t.platform = ? AND t.identifier = ?`,
      )
      .get(userId, platform, identifier) as Row | undefined;
    return row ? mapTracked(row) : null;
  }

  async createTracked(input: NewTrackedProfile): Promise<TrackedProfile> {
    const id = randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        "INSERT INTO tracked_profiles (id, owner_id, platform, identifier, canonical_url, label, monitoring_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)",
      )
      .run(id, input.ownerId, input.platform, input.identifier, input.canonicalUrl, input.label ?? null, now, now);
    const created = await this.getTracked(input.ownerId, id);
    if (!created) throw new Error("Failed to create tracked profile");
    return created;
  }

  async updateTracked(
    userId: string,
    id: string,
    updates: {
      label?: string | null;
      monitoringStatus?: TrackedProfile["monitoringStatus"];
      lastSyncedAt?: string | null;
      lastSyncStatus?: SyncJobStatus | null;
      lastErrorCode?: string | null;
    },
  ): Promise<TrackedProfile> {
    const fields: string[] = [];
    const values: (string | null)[] = [];
    const push = (column: string, value: string | null | undefined) => {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    };
    push("label", updates.label);
    push("monitoring_status", updates.monitoringStatus);
    push("last_synced_at", updates.lastSyncedAt);
    push("last_sync_status", updates.lastSyncStatus);
    push("last_error_code", updates.lastErrorCode);
    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(nowIso());
      this.db
        .prepare(`UPDATE tracked_profiles SET ${fields.join(", ")} WHERE id = ? AND owner_id = ?`)
        .run(...values, id, userId);
    }
    const updated = await this.getTracked(userId, id);
    if (!updated) throw new Error("Tracked profile not found after update");
    return updated;
  }

  async deleteTracked(userId: string, id: string): Promise<void> {
    this.db.prepare("DELETE FROM tracked_profiles WHERE id = ? AND owner_id = ?").run(id, userId);
  }

  async getTrackedForSync(id: string): Promise<TrackedProfile | null> {
    const row = this.db
      .prepare(
        `SELECT t.*, s.followers_count, s.following_count, s.media_count,
                s.observed_at AS metrics_observed_at, s.source AS metrics_source
         FROM tracked_profiles t
         LEFT JOIN metric_snapshots s ON s.id = (
           SELECT id FROM metric_snapshots WHERE tracked_profile_id = t.id
           ORDER BY observed_at DESC, created_at DESC LIMIT 1
         )
         WHERE t.id = ?`,
      )
      .get(id) as Row | undefined;
    return row ? mapTracked(row) : null;
  }

  async listDueRetryJobs(limit: number): Promise<{ job: SyncJob; tracked: TrackedProfile }[]> {
    const now = nowIso();
    const rows = this.db
      .prepare(
        "SELECT * FROM sync_jobs WHERE status = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?",
      )
      .all(now, Math.min(Math.max(limit, 1), 50)) as Row[];
    const out: { job: SyncJob; tracked: TrackedProfile }[] = [];
    for (const row of rows) {
      const job = mapSyncJob(row);
      const tracked = await this.getTrackedForSync(job.trackedProfileId);
      if (tracked) out.push({ job, tracked });
    }
    return out;
  }

  async listDueTracked(limit: number): Promise<TrackedProfile[]> {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const rows = this.db
      .prepare(
        `SELECT t.*, s.followers_count, s.following_count, s.media_count,
                s.observed_at AS metrics_observed_at, s.source AS metrics_source
         FROM tracked_profiles t
         LEFT JOIN metric_snapshots s ON s.id = (
           SELECT id FROM metric_snapshots WHERE tracked_profile_id = t.id
           ORDER BY observed_at DESC, created_at DESC LIMIT 1
         )
         WHERE t.monitoring_status = 'active'
           AND (t.last_synced_at IS NULL OR t.last_synced_at < ?)
         ORDER BY COALESCE(t.last_synced_at, t.created_at) ASC
         LIMIT ?`,
      )
      .all(cutoff, Math.min(Math.max(limit, 1), 100)) as Row[];
    return rows.map(mapTracked);
  }

  async insertSnapshot(input: NewMetricSnapshot): Promise<MetricSnapshot> {
    const id = randomUUID();
    const observedAt = input.observedAt;
    this.db
      .prepare(
        "INSERT INTO metric_snapshots (id, owner_id, tracked_profile_id, observed_at, followers_count, following_count, media_count, source, sync_job_id, sync_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)",
      )
      .run(
        id,
        input.ownerId,
        input.trackedProfileId,
        observedAt,
        input.followers ?? null,
        input.following ?? null,
        input.mediaCount ?? null,
        input.source,
        input.syncJobId ?? null,
        nowIso(),
      );
    const row = this.db.prepare("SELECT * FROM metric_snapshots WHERE id = ?").get(id) as Row;
    return mapSnapshot(row);
  }

  async listSnapshots(
    userId: string,
    trackedProfileId: string,
    range: SnapshotRange = {},
  ): Promise<MetricSnapshot[]> {
    const where = ["owner_id = ?", "tracked_profile_id = ?"];
    const params: (string | number)[] = [userId, trackedProfileId];
    if (range.from) {
      where.push("observed_at >= ?");
      params.push(range.from);
    }
    if (range.to) {
      where.push("observed_at < ?");
      params.push(range.to);
    }
    params.push(Math.min(Math.max(range.limit ?? 1000, 1), 5000));
    const rows = this.db
      .prepare(
        `SELECT * FROM metric_snapshots WHERE ${where.join(" AND ")} ORDER BY observed_at ASC, created_at ASC LIMIT ?`,
      )
      .all(...params) as Row[];
    return rows.map(mapSnapshot);
  }

  async insertSyncJob(input: {
    ownerId: string;
    trackedProfileId: string;
    status: SyncJobStatus;
    startedAt: string;
  }): Promise<SyncJob> {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO sync_jobs (id, owner_id, tracked_profile_id, status, started_at, retry_count, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      )
      .run(id, input.ownerId, input.trackedProfileId, input.status, input.startedAt, nowIso());
    const row = this.db.prepare("SELECT * FROM sync_jobs WHERE id = ?").get(id) as Row;
    return mapSyncJob(row);
  }

  async updateSyncJob(
    ownerId: string,
    id: string,
    updates: Partial<
      Pick<SyncJob, "status" | "completedAt" | "retryCount" | "nextAttemptAt" | "errorCode" | "safeError">
    >,
  ): Promise<void> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const push = (column: string, value: string | number | null | undefined) => {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    };
    push("status", updates.status);
    push("completed_at", updates.completedAt);
    push("retry_count", updates.retryCount);
    push("next_attempt_at", updates.nextAttemptAt);
    push("error_code", updates.errorCode);
    push("safe_error", updates.safeError);
    if (fields.length > 0) {
      this.db
        .prepare(`UPDATE sync_jobs SET ${fields.join(", ")} WHERE id = ? AND owner_id = ?`)
        .run(...values, id, ownerId);
    }
  }

  async listSyncJobs(
    userId: string,
    options: { limit?: number; trackedProfileId?: string; statuses?: SyncJobStatus[] } = {},
  ): Promise<SyncJob[]> {
    const where = ["owner_id = ?"];
    const params: (string | number)[] = [userId];
    if (options.trackedProfileId) {
      where.push("tracked_profile_id = ?");
      params.push(options.trackedProfileId);
    }
    if (options.statuses && options.statuses.length > 0) {
      where.push(`status IN (${options.statuses.map(() => "?").join(",")})`);
      params.push(...options.statuses);
    }
    params.push(Math.min(Math.max(options.limit ?? 20, 1), 100));
    const rows = this.db
      .prepare(
        `SELECT * FROM sync_jobs WHERE ${where.join(" AND ")} ORDER BY started_at DESC LIMIT ?`,
      )
      .all(...params) as Row[];
    return rows.map(mapSyncJob);
  }

  async replaceMedia(userId: string, trackedProfileId: string, items: NewMediaItem[]): Promise<void> {
    const fetchedAt = nowIso();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM media_items WHERE owner_id = ? AND tracked_profile_id = ?")
        .run(userId, trackedProfileId);
      const insert = this.db.prepare(
        "INSERT INTO media_items (id, owner_id, tracked_profile_id, provider_media_id, media_type, published_at, source_url, thumbnail_url, permalink, caption, like_count, comments_count, retrieval_status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const item of items.slice(0, 60)) {
        insert.run(
          randomUUID(),
          userId,
          trackedProfileId,
          item.providerMediaId.slice(0, 200),
          item.mediaType,
          item.publishedAt ?? null,
          item.sourceUrl ?? null,
          item.thumbnailUrl ?? null,
          item.permalink ?? null,
          item.caption?.slice(0, 2200) ?? null,
          item.likeCount ?? null,
          item.commentsCount ?? null,
          item.retrievalStatus,
          fetchedAt,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async listMedia(userId: string, trackedProfileId: string, limit = 24): Promise<MediaItemRecord[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM media_items WHERE owner_id = ? AND tracked_profile_id = ? ORDER BY published_at IS NULL, published_at DESC LIMIT ?",
      )
      .all(userId, trackedProfileId, Math.min(Math.max(limit, 1), 60)) as Row[];
    return rows.map(mapMedia);
  }

  async createReport(input: Omit<ReportRun, "id" | "generatedAt">): Promise<ReportRun> {
    const id = randomUUID();
    const generatedAt = nowIso();
    this.db
      .prepare(
        "INSERT INTO reports (id, owner_id, tracked_profile_id, period_start, period_end, generated_at, row_count, format) VALUES (?, ?, ?, ?, ?, ?, ?, 'csv')",
      )
      .run(
        id,
        input.ownerId,
        input.trackedProfileId ?? null,
        input.periodStart,
        input.periodEnd,
        generatedAt,
        input.rowCount,
      );
    const row = this.db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Row;
    return mapReport(row);
  }

  async listReports(userId: string, limit = 10): Promise<ReportRun[]> {
    const rows = this.db
      .prepare("SELECT * FROM reports WHERE owner_id = ? ORDER BY generated_at DESC LIMIT ?")
      .all(userId, Math.min(Math.max(limit, 1), 50)) as Row[];
    return rows.map(mapReport);
  }

  async getDashboard(userId: string): Promise<DashboardData> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const count = (sql: string, ...params: string[]) =>
      optionalNumber((this.db.prepare(sql).get(...params) as Row).n) ?? 0;

    const stats = {
      trackedCount: await this.countTracked(userId),
      successfulSyncs7d: count(
        "SELECT COUNT(*) AS n FROM sync_jobs WHERE owner_id = ? AND status = 'succeeded' AND started_at >= ?",
        userId,
        since7d,
      ),
      reportsCount: count("SELECT COUNT(*) AS n FROM reports WHERE owner_id = ?", userId),
      errors7d: count(
        "SELECT COUNT(*) AS n FROM sync_jobs WHERE owner_id = ? AND status IN ('failed','retry_scheduled','failed_permanent') AND started_at >= ?",
        userId,
        since7d,
      ),
    };
    const pointRows = this.db
      .prepare(
        `SELECT observed_at, followers_count FROM metric_snapshots
         WHERE owner_id = ? AND observed_at >= ? AND followers_count IS NOT NULL
         ORDER BY observed_at ASC LIMIT 500`,
      )
      .all(userId, since14d) as Row[];
    return {
      stats,
      recentProfiles: await this.listTracked(userId, { limit: 5 }),
      recentSyncs: await this.listSyncJobs(userId, { limit: 5 }),
      latestReports: await this.listReports(userId, 3),
      recentErrors: await this.listSyncJobs(userId, {
        limit: 5,
        statuses: ["failed", "retry_scheduled", "failed_permanent"],
      }),
      observationPoints: pointRows.map((row) => ({
        observedAt: asString(row.observed_at),
        followers: optionalNumber(row.followers_count),
      })),
    };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.getUserProfile(userId);
    const accounts = await this.listConnectedAccounts(userId);
    const tracked = await this.listTracked(userId, { limit: 100 });
    const snapshots: MetricSnapshot[] = [];
    const media: MediaItemRecord[] = [];
    for (const item of tracked) {
      snapshots.push(...(await this.listSnapshots(userId, item.id, { limit: 5000 })));
      media.push(...(await this.listMedia(userId, item.id, 60)));
    }
    return {
      exportedAt: nowIso(),
      profile,
      connectedAccounts: accounts, // token ciphertext is never included
      trackedProfiles: tracked,
      snapshots,
      syncJobs: await this.listSyncJobs(userId, { limit: 100 }),
      media,
      reports: await this.listReports(userId, 50),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM connected_accounts WHERE owner_id = ?").run(userId);
      this.db.prepare("DELETE FROM tracked_profiles WHERE owner_id = ?").run(userId);
      this.db.prepare("DELETE FROM reports WHERE owner_id = ?").run(userId);
      this.db.prepare("UPDATE users SET updated_at = ? WHERE id = ?").run(nowIso(), userId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async insertContactMessage(input: Omit<ContactMessage, "id" | "createdAt">): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO contact_messages (id, name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), input.name, input.email, input.subject, input.message, nowIso());
  }
}

export function createLocalRepository(): LocalRepository {
  return new LocalRepository();
}
