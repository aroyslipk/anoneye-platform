import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";

export const JSON_BODY_LIMIT_BYTES = 16 * 1024;

/**
 * CSRF defence for cookie-authenticated mutations: require a same-origin
 * Origin (or Referer fallback). Missing origin is rejected for browser routes;
 * bearer-protected cron routes do not use this helper.
 */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const expected = host ? `${proto}://${host}` : request.nextUrl.origin;

  if (origin) {
    if (origin !== expected) {
      throw new ForbiddenError("Cross-origin request rejected");
    }
    return;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;

  // Non-browser clients without Origin are rejected here. This prevents a
  // plain HTML form post from another site from mutating a signed-in account.
  throw new ForbiddenError("Missing origin header");
}

export async function readJsonBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  maxBytes = JSON_BODY_LIMIT_BYTES,
): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new UnsupportedMediaTypeError();
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError();
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PayloadTooLargeError();
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Request body failed validation", {
      fields: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 8),
    });
  }
  return parsed.data;
}

/** Restrict post-login redirects to known same-site paths. */
const SAFE_REDIRECT_PATHS = [
  "/dashboard",
  "/dashboard/tracked",
  "/dashboard/reports",
  "/settings",
] as const;

export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  const path = trimmed.split(/[?#]/)[0];
  const allowed =
    (SAFE_REDIRECT_PATHS as readonly string[]).includes(path) || /^\/profile\/[a-z]+\/[A-Za-z0-9._-]{1,60}\/?$/.test(path);
  return allowed ? trimmed : fallback;
}

export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
