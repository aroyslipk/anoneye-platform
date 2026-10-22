import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getLocalDb } from "@/lib/db/local";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";
import type { UserRecord } from "@/lib/db/types";

/**
 * Local email/password authentication for the SQLite development backend.
 * Production deployments use Supabase Auth; this module refuses to run when
 * the local backend is not explicitly allowed.
 */

export const SESSION_COOKIE = "anoneye_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

type Row = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// A stable dummy hash keeps failed-login timing close to a real verification.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("anoneye-timing-placeholder-not-a-password");
  return dummyHashPromise;
}

export class LocalAuthError extends Error {
  constructor(
    readonly code: "email_taken" | "invalid_credentials" | "weak_password",
    message: string,
  ) {
    super(message);
    this.name = "LocalAuthError";
  }
}

export async function createLocalUser(
  emailInput: string,
  password: string,
  displayName?: string,
): Promise<UserRecord> {
  const email = normalizeEmail(emailInput);
  const db = getLocalDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new LocalAuthError("email_taken", "Email is already registered");
  const id = randomUUID();
  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);
  try {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, locale, theme, created_at, updated_at) VALUES (?, ?, ?, ?, 'bn', 'system', ?, ?)",
    ).run(id, email, passwordHash, displayName?.trim() || null, timestamp, timestamp);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      throw new LocalAuthError("email_taken", "Email is already registered");
    }
    throw error;
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row;
  return mapUser(row);
}

export async function verifyLocalCredentials(
  emailInput: string,
  password: string,
): Promise<UserRecord | null> {
  const email = normalizeEmail(emailInput);
  const db = getLocalDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Row | undefined;
  if (!row) {
    await verifyPassword(password, await getDummyHash());
    return null;
  }
  const valid = await verifyPassword(password, String(row.password_hash));
  return valid ? mapUser(row) : null;
}

export async function createLocalSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  getLocalDb()
    .prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, hashSessionToken(token), expiresAt, nowIso());
  return { token, expiresAt };
}

export async function getLocalSessionUser(token: string | undefined): Promise<UserRecord | null> {
  if (!token || token.length > 200) return null;
  const db = getLocalDb();
  const row = db
    .prepare(
      "SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    )
    .get(hashSessionToken(token)) as Row | undefined;
  if (!row) return null;
  if (String(row.expires_at) <= nowIso()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
    return null;
  }
  return mapUser(row);
}

export async function deleteLocalSession(token: string | undefined): Promise<void> {
  if (!token) return;
  getLocalDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

export async function deleteAllLocalSessions(userId: string): Promise<void> {
  getLocalDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export async function deleteLocalUser(userId: string): Promise<void> {
  getLocalDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function pruneExpiredSessions(): void {
  getLocalDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}
