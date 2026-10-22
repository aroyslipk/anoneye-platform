/**
 * Minimal structured logger with aggressive redaction.
 *
 * Secrets must never reach application logs. We only log the message of known
 * errors, never request headers, cookies, query strings containing tokens, or
 * provider response bodies.
 */

const SENSITIVE_KEY = /(token|secret|password|authorization|cookie|api[-_]?key|session)/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const ACCESS_TOKEN_QUERY = /([?&](?:access_token|code|state)=)[^&\s]+/gi;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") {
      return value
        .replace(BEARER, "Bearer [redacted]")
        .replace(ACCESS_TOKEN_QUERY, "$1[redacted]");
    }
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => emit("debug", event, context),
  info: (event: string, context?: Record<string, unknown>) => emit("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) => emit("error", event, context),
};

/** Safe error description for logs: no stack traces from provider responses. */
export function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message.replace(BEARER, "Bearer [redacted]") };
  }
  return { name: "UnknownError", message: "Non-Error thrown" };
}
