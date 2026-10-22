import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { enforceRateLimit } from "@/lib/api/handler";
import { RateLimitError } from "@/lib/errors";
import { consumeRateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";

describe("consumeRateLimit", () => {
  it("allows up to the limit inside one window and blocks afterwards", () => {
    const now = 1_000_000;
    for (let index = 0; index < 3; index += 1) {
      expect(consumeRateLimit("test:a", 3, 60_000, now).allowed).toBe(true);
    }
    const blocked = consumeRateLimit("test:a", 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    expect(consumeRateLimit("test:b", 1, 1_000, 0).allowed).toBe(true);
    expect(consumeRateLimit("test:b", 1, 1_000, 500).allowed).toBe(false);
    expect(consumeRateLimit("test:b", 1, 1_000, 1_001).allowed).toBe(true);
  });

  it("keeps buckets isolated per key", () => {
    expect(consumeRateLimit("test:c1", 1, 1_000, 0).allowed).toBe(true);
    expect(consumeRateLimit("test:c1", 1, 1_000, 0).allowed).toBe(false);
    expect(consumeRateLimit("test:c2", 1, 1_000, 0).allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  function request(ip: string) {
    return new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": ip },
    });
  }

  it("keys anonymous requests by client IP", () => {
    resetRateLimitsForTests();
    enforceRateLimit(request("203.0.113.7"), "unit-ip", 2, 60);
    enforceRateLimit(request("203.0.113.7"), "unit-ip", 2, 60);
    expect(() => enforceRateLimit(request("203.0.113.7"), "unit-ip", 2, 60)).toThrow(RateLimitError);
    // A different IP has its own bucket.
    expect(() => enforceRateLimit(request("203.0.113.8"), "unit-ip", 2, 60)).not.toThrow();
  });

  it("keys signed-in requests by user id, not IP", () => {
    resetRateLimitsForTests();
    enforceRateLimit(request("203.0.113.9"), "unit-user", 1, 60, "user-a");
    expect(() => enforceRateLimit(request("203.0.113.10"), "unit-user", 1, 60, "user-a")).toThrow(
      RateLimitError,
    );
    expect(() => enforceRateLimit(request("203.0.113.9"), "unit-user", 1, 60, "user-b")).not.toThrow();
  });
});
