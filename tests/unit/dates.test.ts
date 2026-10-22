import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  addDays,
  eachUtcDay,
  formatDateOnly,
  isDateOnly,
  parseDateOnly,
  startOfUtcWeek,
  todayUtc,
} from "@/lib/utils/dates";
import { MAX_REPORT_DAYS, resolveReportRange } from "@/lib/services/reports";

describe("date utilities", () => {
  it("validates and parses YYYY-MM-DD strictly", () => {
    expect(isDateOnly("2026-10-22")).toBe(true);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("2026-02-30")).toBe(false); // full calendar validation
    expect(isDateOnly("22/10/2026")).toBe(false);
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-10-22")?.toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("adds days in UTC and formats them back", () => {
    const day = new Date("2026-10-22T00:00:00.000Z");
    expect(formatDateOnly(addDays(day, 1))).toBe("2026-10-23");
    expect(formatDateOnly(addDays(day, -30))).toBe("2026-09-22");
    expect(todayUtc(new Date("2026-10-22T23:59:59.000Z"))).toBe("2026-10-22");
  });

  it("starts weeks on Monday in UTC", () => {
    // 2026-10-22 is a Thursday.
    expect(formatDateOnly(startOfUtcWeek(new Date("2026-10-22T10:00:00.000Z")))).toBe("2026-10-19");
    expect(formatDateOnly(startOfUtcWeek(new Date("2026-10-19T00:00:00.000Z")))).toBe("2026-10-19");
  });

  it("enumerates UTC days half-open", () => {
    const days = eachUtcDay(new Date("2026-10-01T00:00:00.000Z"), new Date("2026-10-04T00:00:00.000Z"));
    expect(days.map(formatDateOnly)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
});

describe("resolveReportRange", () => {
  it("defaults to the last 30 UTC days", () => {
    const range = resolveReportRange();
    expect(range.days).toBe(30);
    expect(range.toIsoExclusive > range.fromIso).toBe(true);
  });

  it("accepts an explicit range", () => {
    const range = resolveReportRange("2026-01-01", "2026-01-31");
    expect(range.days).toBe(31);
    expect(range.fromIso).toBe("2026-01-01T00:00:00.000Z");
    expect(range.toIsoExclusive).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rejects reversed, malformed and oversized ranges", () => {
    expect(() => resolveReportRange("2026-02-01", "2026-01-01")).toThrow(ValidationError);
    expect(() => resolveReportRange("2026-02-31", "2026-03-01")).toThrow(ValidationError);
    expect(() => resolveReportRange("not-a-date")).toThrow(ValidationError);
    expect(() => resolveReportRange("2025-01-01", "2026-10-22")).toThrow(/366/);
  });

  it("allows exactly the maximum window", () => {
    const range = resolveReportRange("2025-01-01", "2026-01-01");
    expect(range.days).toBe(MAX_REPORT_DAYS);
  });
});
