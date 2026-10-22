/**
 * Error taxonomy shared by the API layer and services.
 *
 * Internal error messages are never sent to the browser. Each error carries a
 * stable machine code that the UI translates, plus an optional retry hint.
 */

export type ErrorCode =
  | "bad_request"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "not_configured"
  | "upstream_unavailable"
  | "payload_too_large"
  | "unsupported_media_type"
  | "unsupported"
  | "internal_error";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly publicDetails?: Record<string, string | number | boolean | string[]>;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options?: {
      retryAfterSeconds?: number;
      publicDetails?: Record<string, string | number | boolean | string[]>;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.publicDetails = options?.publicDetails;
  }
}

export class ConfigError extends AppError {
  constructor(message: string, details?: Record<string, string | number | boolean | string[]>) {
    super("not_configured", 503, message, { publicDetails: details });
    this.name = "ConfigError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", details?: Record<string, string | number | boolean | string[]>) {
    super("invalid_input", 400, message, { publicDetails: details });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("unauthorized", 401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed") {
    super("forbidden", 403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("not_found", 404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super("conflict", 409, message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds = 60) {
    super("rate_limited", 429, "Too many requests", { retryAfterSeconds });
    this.name = "RateLimitError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super("payload_too_large", 413, "Request body too large");
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super("unsupported_media_type", 415, "Unsupported content type");
    this.name = "UnsupportedMediaTypeError";
  }
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryAfterSeconds?: number;
    details?: Record<string, string | number | boolean | string[]>;
  };
}

export function toApiError(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
          ...(error.publicDetails ? { details: error.publicDetails } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "internal_error", message: "Unexpected server error" } },
  };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
