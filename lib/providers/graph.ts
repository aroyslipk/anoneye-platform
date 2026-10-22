import "server-only";
import { getEnv } from "@/lib/env";
import { describeError, logger } from "@/lib/logger";
import type { CapabilityId, ProviderResult } from "./types";

/**
 * Minimal Meta Graph API client.
 *
 * Security properties:
 * - the host is a constant (`graph.facebook.com`); no user-supplied URL is fetched
 * - the access token travels in an Authorization header, never in a logged URL
 * - responses are capped and parsed defensively
 * - no automatic retries: callers decide based on the classified error
 */

export type GraphErrorKind = "unauthorized" | "permission" | "rate-limited" | "not-found" | "unavailable" | "invalid";

export class GraphApiError extends Error {
  readonly kind: GraphErrorKind;
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    message: string;
    kind: GraphErrorKind;
    status: number;
    code?: number;
    subcode?: number;
    traceId?: string;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.name = "GraphApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.subcode = options.subcode;
    this.traceId = options.traceId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function graphVersion(): string {
  return getEnv().META_GRAPH_VERSION;
}

export function graphSourceLabel(): string {
  return `Meta Graph API (${graphVersion()})`;
}

const IDENTIFIER = /^[A-Za-z0-9._-]+$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

interface GraphErrorPayload {
  error?: {
    message?: unknown;
    type?: unknown;
    code?: unknown;
    error_subcode?: unknown;
    error_user_title?: unknown;
    error_user_msg?: unknown;
    fbtrace_id?: unknown;
  };
}

function rateLimitSeconds(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number.parseInt(retryAfter, 10);
  return Number.isFinite(seconds) && seconds > 0 && seconds < 86_400 ? seconds : undefined;
}

function classify(status: number, code: number | undefined, message: string): GraphErrorKind {
  if (status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) return "rate-limited";
  if (code === 190 || code === 102) return "unauthorized";
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) return "permission";
  if (code === 803) return "not-found";
  if (code === 100) {
    if (/nonexist|does not exist|cannot be loaded|invalid user id|unknown username|not found/i.test(message)) {
      return "not-found";
    }
    return "invalid";
  }
  if (status >= 500) return "unavailable";
  return "invalid";
}

export interface GraphRequest {
  /** Path below the API version, e.g. "me/accounts" or "17841400000000". */
  path: string;
  params?: Record<string, string | number | undefined>;
  accessToken: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function graphFetch<T>(request: GraphRequest): Promise<T> {
  const segments = request.path.split("/").filter(Boolean);
  if (segments.length === 0 || !segments.every((segment) => IDENTIFIER.test(segment))) {
    throw new GraphApiError({ message: "Invalid Graph API path", kind: "invalid", status: 0 });
  }
  if (!request.accessToken) {
    throw new GraphApiError({ message: "Missing access token", kind: "unauthorized", status: 401 });
  }

  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${segments.join("/")}`);
  for (const [key, value] of Object.entries(request.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${request.accessToken}`, accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    logger.warn("graph_request_failed", { path: segments.join("/"), error: describeError(error) });
    throw new GraphApiError({
      message: controller.signal.aborted ? "The Graph API request timed out" : "The Graph API request failed",
      kind: "unavailable",
      status: 0,
    });
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener("abort", onAbort);
  }

  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new GraphApiError({ message: "Graph API response too large", kind: "unavailable", status: 502 });
  }

  const text = await response.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new GraphApiError({ message: "Graph API response too large", kind: "unavailable", status: 502 });
  }

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as GraphErrorPayload | null)?.error;
    const code = typeof error?.code === "number" ? error.code : undefined;
    const subcode = typeof error?.error_subcode === "number" ? error.error_subcode : undefined;
    const message = typeof error?.message === "string" ? error.message : "";
    const kind = classify(response.status, code, message);
    // Log identifiers only: never the message body, token, or full URL.
    logger.warn("graph_api_error", {
      path: segments.join("/"),
      status: response.status,
      code,
      subcode,
      traceId: typeof error?.fbtrace_id === "string" ? error.fbtrace_id : undefined,
    });
    throw new GraphApiError({
      message: `Graph API error${code === undefined ? "" : ` (code ${code})`}`,
      kind,
      status: response.status,
      code,
      subcode,
      traceId: typeof error?.fbtrace_id === "string" ? error.fbtrace_id : undefined,
      retryAfterSeconds: rateLimitSeconds(response.headers),
    });
  }

  return payload as T;
}

/** Convert a thrown Graph error into the shared provider result union. */
export function providerFailure(error: unknown, source: string): ProviderResult<never> {
  if (error instanceof GraphApiError) {
    switch (error.kind) {
      case "unauthorized":
      case "permission":
        return { kind: "unauthorized", source };
      case "rate-limited":
        return { kind: "rate-limited", source, retryAfterSeconds: error.retryAfterSeconds };
      case "not-found":
        return { kind: "not-found", source };
      case "invalid":
        return { kind: "not-found", source };
      default:
        return { kind: "unavailable", source };
    }
  }
  logger.error("provider_unexpected_error", { source, error: describeError(error) });
  return { kind: "unavailable", source };
}

const MEDIA_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];
const PERMALINK_HOSTS: Record<"instagram" | "facebook", ReadonlySet<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  facebook: new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"]),
};

/** Only direct, HTTPS media URLs from Meta CDNs are ever placed in an <img>. */
export function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
    const host = url.hostname.toLowerCase();
    if (!MEDIA_SUFFIXES.some((suffix) => host.endsWith(suffix))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function safePermalink(platform: "instagram" | "facebook", value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
    if (!PERMALINK_HOSTS[platform].has(url.hostname.toLowerCase())) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Returns a cleaned, length-capped caption or undefined. */
export function safeCaption(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 2000);
}

export function missingConfigResult(missing: string[], capability: CapabilityId = "profile-lookup"): ProviderResult<never> {
  void capability;
  return { kind: "not-configured", missing };
}
