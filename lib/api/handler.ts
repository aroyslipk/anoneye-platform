import { NextResponse, type NextRequest } from "next/server";
import { toApiError, RateLimitError } from "@/lib/errors";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/security/rate-limit";
import { logger, describeError } from "@/lib/logger";

/** Uniform JSON API envelope; never caches user-specific responses. */
export function apiJson(data: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  return NextResponse.json(data, { ...init, headers });
}

export function apiError(error: unknown): NextResponse {
  const { status, body } = toApiError(error);
  const headers = new Headers({
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
  });
  if (body.error.retryAfterSeconds) {
    headers.set("retry-after", String(body.error.retryAfterSeconds));
  }
  if (status >= 500) {
    logger.error("api_unhandled_error", { error: describeError(error) });
  }
  return NextResponse.json(body, { status, headers });
}

export function enforceRateLimit(
  request: NextRequest,
  name: string,
  limit: number,
  windowSeconds: number,
  userKey?: string,
): void {
  const key = userKey ? `${name}:user:${userKey}` : `${name}:ip:${clientIpFromHeaders(request.headers)}`;
  const result = consumeRateLimit(key, limit, windowSeconds * 1000);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}

export function bearerMatches(request: NextRequest, expected: string | undefined): boolean {
  if (!expected || expected.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const supplied = match[1];
  // Constant-time-ish comparison without importing node:crypto into the edge
  // path; both strings are server-side secrets with equal expected length.
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return diff === 0;
}
