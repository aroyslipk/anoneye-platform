import { describe, expect, it } from "vitest";
import { createLocalUser } from "@/lib/auth/local-auth";
import { createLocalRepository } from "@/lib/db/local";
import { saveTrackedProfile, seedDemoHistory, syncTrackedProfile } from "@/lib/services/sync";
import { ConfigError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/session";

let counter = 0;
async function user(): Promise<AuthUser> {
  counter += 1;
  const record = await createLocalUser(`sync-${Date.now()}-${counter}@example.com`, "password123");
  return { id: record.id, email: record.email, provider: "local" };
}

describe("demo sync", () => {
  it("records an observation only after a successful provider lookup", async () => {
    const repo = createLocalRepository();
    const owner = await user();

    const saved = await saveTrackedProfile({
      user: owner,
      repo,
      platform: "instagram",
      rawInput: "@Anoneye.Demo",
    });

    expect(saved.sync.result.kind).toBe("ok");
    expect(saved.sync.snapshotCreated).toBe(true);
    expect(saved.tracked.identifier).toBe("anoneye.demo");
    expect(saved.tracked.lastSyncStatus).toBe("succeeded");
    expect(saved.tracked.latest?.followers).toBe(12480);
    expect(saved.tracked.latest?.source).toMatch(/demo/i);

    const snapshots = await repo.listSnapshots(owner.id, saved.tracked.id);
    expect(snapshots).toHaveLength(1);
    // The observation timestamp comes from the fixture's fetch time, not the client.
    expect(new Date(snapshots[0].observedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("creates a new snapshot per manual refresh", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    const saved = await saveTrackedProfile({
      user: owner,
      repo,
      platform: "facebook",
      rawInput: "anoneye.demo",
    });

    const second = await syncTrackedProfile({ user: owner, repo, tracked: saved.tracked });
    expect(second.result.kind).toBe("ok");
    expect(second.snapshotCreated).toBe(true);
    const snapshots = await repo.listSnapshots(owner.id, saved.tracked.id);
    expect(snapshots.length).toBe(2);
    expect(snapshots[1].observedAt >= snapshots[0].observedAt).toBe(true);
  });

  it("rejects a duplicate tracked profile with a conflict", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    await saveTrackedProfile({ user: owner, repo, platform: "instagram", rawInput: "anoneye.demo" });
    await expect(
      saveTrackedProfile({ user: owner, repo, platform: "instagram", rawInput: "anoneye.demo" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await repo.countTracked(owner.id)).toBe(1);
  });

  it("does not keep a tracked row when the provider is not configured", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    await expect(
      saveTrackedProfile({ user: owner, repo, platform: "instagram", rawInput: "nasa" }),
    ).rejects.toBeInstanceOf(ConfigError);
    // A row that cannot be monitored would falsely imply monitoring.
    expect(await repo.countTracked(owner.id)).toBe(0);
  });

  it("seeds labelled demo history once and reports it as demo data", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    const saved = await saveTrackedProfile({
      user: owner,
      repo,
      platform: "instagram",
      rawInput: "anoneye.demo",
    });

    expect(await seedDemoHistory({ user: owner, repo, tracked: saved.tracked })).toBe(14);
    expect(await seedDemoHistory({ user: owner, repo, tracked: saved.tracked })).toBe(0);

    const snapshots = await repo.listSnapshots(owner.id, saved.tracked.id);
    expect(snapshots).toHaveLength(15);
    expect(snapshots.every((snapshot) => /demo/i.test(snapshot.source))).toBe(true);
  });

  it("refuses demo history for a real identifier", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    const tracked = await repo.createTracked({
      ownerId: owner.id,
      platform: "instagram",
      identifier: "nasa",
      canonicalUrl: "https://www.instagram.com/nasa/",
    });
    await expect(seedDemoHistory({ user: owner, repo, tracked })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("runs the scheduled worker over due profiles", async () => {
    const repo = createLocalRepository();
    const owner = await user();
    await saveTrackedProfile({ user: owner, repo, platform: "instagram", rawInput: "anoneye.demo" });
    const { runScheduledSync } = await import("@/lib/services/sync");
    const summary = await runScheduledSync(repo, 5);
    expect(summary.attempted).toBeGreaterThanOrEqual(0);
    expect(summary.attempted).toBeLessThanOrEqual(5);
    expect(summary.succeeded + summary.failed + summary.skipped).toBeLessThanOrEqual(summary.attempted);
  });
});
