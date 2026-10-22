import { describe, expect, it } from "vitest";
import { createLocalUser } from "@/lib/auth/local-auth";
import { createLocalRepository } from "@/lib/db/local";

let counter = 0;
async function user() {
  counter += 1;
  const record = await createLocalUser(`owner-${Date.now()}-${counter}@example.com`, "password123", "Owner");
  return { id: record.id, email: record.email, provider: "local" as const };
}

describe("repository ownership isolation", () => {
  it("never exposes another user's tracked profile", async () => {
    const repo = createLocalRepository();
    const alice = await user();
    const bob = await user();

    const tracked = await repo.createTracked({
      ownerId: alice.id,
      platform: "instagram",
      identifier: "anoneye.demo",
      canonicalUrl: "https://www.instagram.com/anoneye.demo/",
    });

    expect(await repo.getTracked(alice.id, tracked.id)).not.toBeNull();
    expect(await repo.getTracked(bob.id, tracked.id)).toBeNull();
    expect(await repo.findTracked(bob.id, "instagram", "anoneye.demo")).toBeNull();
    expect(await repo.countTracked(bob.id)).toBe(0);
    expect(await repo.listTracked(bob.id)).toHaveLength(0);
  });

  it("cannot delete or update another user's row", async () => {
    const repo = createLocalRepository();
    const alice = await user();
    const bob = await user();
    const tracked = await repo.createTracked({
      ownerId: alice.id,
      platform: "facebook",
      identifier: "anoneye.demo",
      canonicalUrl: "https://www.facebook.com/anoneye.demo",
      label: "Alice's page",
    });

    await repo.deleteTracked(bob.id, tracked.id);
    await expect(repo.updateTracked(bob.id, tracked.id, { label: "hijacked" })).rejects.toThrow();

    const stillThere = await repo.getTracked(alice.id, tracked.id);
    expect(stillThere?.label).toBe("Alice's page");
    expect(stillThere?.monitoringStatus).toBe("active");
  });

  it("isolates observations and media rows by owner", async () => {
    const repo = createLocalRepository();
    const alice = await user();
    const bob = await user();
    const tracked = await repo.createTracked({
      ownerId: alice.id,
      platform: "instagram",
      identifier: "anoneye.demo",
      canonicalUrl: "https://www.instagram.com/anoneye.demo/",
    });

    await repo.insertSnapshot({
      ownerId: alice.id,
      trackedProfileId: tracked.id,
      observedAt: "2026-10-01T00:00:00.000Z",
      followers: 100,
      source: "unit-test",
    });
    await repo.replaceMedia(alice.id, tracked.id, [
      {
        providerMediaId: "m1",
        mediaType: "image",
        permalink: "https://www.instagram.com/p/abc/",
        retrievalStatus: "listed",
      },
    ]);

    expect(await repo.listSnapshots(alice.id, tracked.id)).toHaveLength(1);
    expect(await repo.listSnapshots(bob.id, tracked.id)).toHaveLength(0);
    expect(await repo.listMedia(bob.id, tracked.id, 10)).toHaveLength(0);
  });

  it("decrementing account data removes only that user's rows", async () => {
    const repo = createLocalRepository();
    const alice = await user();
    const bob = await user();
    await repo.createTracked({
      ownerId: alice.id,
      platform: "instagram",
      identifier: "first.demo",
      canonicalUrl: "https://www.instagram.com/first.demo/",
    });
    await repo.createTracked({
      ownerId: bob.id,
      platform: "instagram",
      identifier: "second.demo",
      canonicalUrl: "https://www.instagram.com/second.demo/",
    });

    await repo.deleteUserData(alice.id);

    expect(await repo.countTracked(alice.id)).toBe(0);
    expect(await repo.countTracked(bob.id)).toBe(1);
  });
});
