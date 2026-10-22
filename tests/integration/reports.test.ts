import { describe, expect, it } from "vitest";
import { createLocalUser } from "@/lib/auth/local-auth";
import { createLocalRepository } from "@/lib/db/local";
import { buildCsv, buildReport, reportFileName, resolveReportRange } from "@/lib/services/reports";
import type { AuthUser } from "@/lib/auth/session";
import type { Repository } from "@/lib/db/types";

let counter = 0;
async function fixture() {
  counter += 1;
  const record = await createLocalUser(`report-${Date.now()}-${counter}@example.com`, "password123");
  const user: AuthUser = { id: record.id, email: record.email, provider: "local" };
  const repo = createLocalRepository();
  const tracked = await repo.createTracked({
    ownerId: user.id,
    platform: "instagram",
    identifier: "report.demo",
    canonicalUrl: "https://www.instagram.com/report.demo/",
    label: "Report fixture",
  });
  return { user, repo, tracked };
}

async function addSnapshot(
  repo: Repository,
  user: AuthUser,
  trackedId: string,
  observedAt: string,
  values: { followers?: number; following?: number; mediaCount?: number },
) {
  await repo.insertSnapshot({
    ownerId: user.id,
    trackedProfileId: trackedId,
    observedAt,
    source: "unit-test",
    ...values,
  });
}

describe("report aggregation", () => {
  it("distinguishes missing days from genuine zero values", async () => {
    const { user, repo, tracked } = await fixture();
    await addSnapshot(repo, user, tracked.id, "2026-10-01T10:00:00.000Z", { followers: 100, following: 50 });
    await addSnapshot(repo, user, tracked.id, "2026-10-03T10:00:00.000Z", { followers: 0 });
    await addSnapshot(repo, user, tracked.id, "2026-10-05T10:00:00.000Z", { followers: 130, following: 60 });

    const range = resolveReportRange("2026-10-01", "2026-10-05");
    const report = await buildReport({ user, repo, trackedId: tracked.id, range });

    expect(report.daily).toHaveLength(5);
    expect(report.coverage).toEqual({ observedDays: 3, missingDays: 2, totalDays: 5 });

    const [, second, third, fourth] = report.daily;
    expect(second.observed).toBe(false);
    expect(second.followers).toBeUndefined(); // missing, not zero
    expect(third.followers).toBe(0); // genuine zero survives
    expect(fourth.observed).toBe(false);

    expect(report.change.followers).toMatchObject({ from: 100, to: 130, absolute: 30, percent: 30, observations: 3 });
    expect(report.change.following).toMatchObject({ from: 50, to: 60, absolute: 10, percent: 20 });
    expect(report.rowCount).toBe(3);
    expect(report.demoData).toBe(false);
    expect(report.dataNotes).toContain("history-starts-at-first-sync");
    expect(report.latestObservedAt).toBe("2026-10-05T10:00:00.000Z");
  });

  it("does not invent a percentage change when there is only one observation", async () => {
    const { user, repo, tracked } = await fixture();
    await addSnapshot(repo, user, tracked.id, "2026-10-02T10:00:00.000Z", { followers: 10 });
    const range = resolveReportRange("2026-10-01", "2026-10-03");
    const report = await buildReport({ user, repo, trackedId: tracked.id, range });
    expect(report.change.followers).toEqual({ observations: 1, from: 10, to: 10 });
    expect(report.change.followers.percent).toBeUndefined();
  });

  it("refuses to build a report for a profile the user does not own", async () => {
    const { repo, tracked } = await fixture();
    const other = await createLocalUser(`other-${Date.now()}@example.com`, "password123");
    await expect(
      buildReport({
        user: { id: other.id, email: other.email, provider: "local" },
        repo,
        trackedId: tracked.id,
        range: resolveReportRange("2026-10-01", "2026-10-03"),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("CSV export", () => {
  it("writes RFC 4180 with a UTF-8 BOM, blank for missing and 0 for zero", async () => {
    const { user, repo, tracked } = await fixture();
    await addSnapshot(repo, user, tracked.id, "2026-10-01T10:00:00.000Z", { followers: 0 });
    await addSnapshot(repo, user, tracked.id, "2026-10-02T10:00:00.000Z", { followers: 5, following: 7 });

    const report = await buildReport({
      user,
      repo,
      trackedId: tracked.id,
      range: resolveReportRange("2026-10-01", "2026-10-02"),
    });
    const csv = buildCsv(report);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "observed_at,date_utc,platform,identifier,label,followers,following,media_count,source,sync_job_id,sync_status",
    );
    const first = lines[1].split(",");
    expect(first[0]).toBe("2026-10-01T10:00:00.000Z");
    expect(first[5]).toBe("0"); // genuine zero
    expect(first[6]).toBe(""); // missing stays blank
    expect(lines[2].split(",")[6]).toBe("7");
  });

  it("quotes separators and neutralises spreadsheet formulas", async () => {
    const { user, repo, tracked } = await fixture();
    await repo.insertSnapshot({
      ownerId: user.id,
      trackedProfileId: tracked.id,
      observedAt: "2026-10-01T10:00:00.000Z",
      followers: 1,
      source: '=HYPERLINK("http://example.com")',
    });
    const report = await buildReport({
      user,
      repo,
      trackedId: tracked.id,
      range: resolveReportRange("2026-10-01", "2026-10-01"),
    });
    const csv = buildCsv(report);
    expect(csv).toContain('"\'=HYPERLINK(""http://example.com"")"');
  });

  it("builds a safe attachment filename", async () => {
    const { user, repo, tracked } = await fixture();
    const report = await buildReport({
      user,
      repo,
      trackedId: tracked.id,
      range: resolveReportRange("2026-10-01", "2026-10-02"),
    });
    expect(reportFileName(report)).toBe("anoneye-instagram-report.demo-2026-10-01_2026-10-02.csv");
  });
});
