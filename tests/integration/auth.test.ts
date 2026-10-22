import { describe, expect, it } from "vitest";
import {
  LocalAuthError,
  createLocalSession,
  createLocalUser,
  deleteLocalSession,
  deleteLocalUser,
  getLocalSessionUser,
  verifyLocalCredentials,
} from "@/lib/auth/local-auth";
import { createLocalRepository } from "@/lib/db/local";

describe("local authentication", () => {
  it("creates a user, rejects duplicates and normalises the email", async () => {
    const record = await createLocalUser("  Person@Example.COM ", "password123", "Person");
    expect(record.email).toBe("person@example.com");

    await expect(createLocalUser("person@example.com", "password123")).rejects.toBeInstanceOf(LocalAuthError);
  });

  it("never stores the password in plaintext", async () => {
    const record = await createLocalUser(`hash-${Date.now()}@example.com`, "password123");
    const row = (await import("@/lib/db/local")).getLocalDb()
      .prepare("SELECT password_hash AS hash FROM users WHERE id = ?")
      .get(record.id) as { hash: string };
    expect(row.hash).not.toContain("password123");
    expect(row.hash.startsWith("scrypt$")).toBe(true);
  });

  it("verifies credentials without revealing which part was wrong", async () => {
    const email = `login-${Date.now()}@example.com`;
    const record = await createLocalUser(email, "password123");
    expect((await verifyLocalCredentials(email, "password123"))?.id).toBe(record.id);
    // Wrong password and unknown email are indistinguishable to the caller.
    expect(await verifyLocalCredentials(email, "wrong-password")).toBeNull();
    expect(await verifyLocalCredentials("nobody@example.com", "password123")).toBeNull();
  });

  it("creates, resolves and revokes session tokens", async () => {
    const email = `session-${Date.now()}@example.com`;
    const record = await createLocalUser(email, "password123");
    const session = await createLocalSession(record.id);

    const resolved = await getLocalSessionUser(session.token);
    expect(resolved?.id).toBe(record.id);
    expect(await getLocalSessionUser("not-a-real-token")).toBeNull();

    await deleteLocalSession(session.token);
    expect(await getLocalSessionUser(session.token)).toBeNull();
  });

  it("cascades user deletion to tracked profiles", async () => {
    const email = `delete-${Date.now()}@example.com`;
    const record = await createLocalUser(email, "password123");
    const repo = createLocalRepository();
    await repo.createTracked({
      ownerId: record.id,
      platform: "instagram",
      identifier: "anoneye.demo",
      canonicalUrl: "https://www.instagram.com/anoneye.demo/",
    });

    // Data deletion keeps the account; full account deletion removes the user
    // row and every dependent row through foreign-key cascades.
    await repo.deleteUserData(record.id);
    expect(await repo.countTracked(record.id)).toBe(0);
    await deleteLocalUser(record.id);
    expect(await repo.getUserProfile(record.id)).toBeNull();
  });
});
