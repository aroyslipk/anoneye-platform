/**
 * Shared provider types for Anoneye's social-platform adapter layer.
 *
 * Milestone 1 ships the input-parsing half of this layer (pure functions,
 * runs in the browser). Live lookups, media, and metrics land with the
 * provider adapters in later milestones — see PLAN.md.
 */

export const PLATFORMS = ["instagram", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** How a capability is currently available to the deployed app. */
export type CapabilityStatus =
  | "available" // works right now, no external credentials needed
  | "requires-config" // documented API supports it; owner must configure credentials / permissions
  | "unverified" // not yet verified against current official documentation; kept disabled
  | "unsupported"; // the official API does not offer this; Anoneye will not fake it

export interface Capability {
  id:
    | "parse-input"
    | "profile-lookup"
    | "public-media"
    | "stories"
    | "metrics-history"
    | "media-download"
    | "visitor-identity";
  status: CapabilityStatus;
  /** Account type + permissions required, in plain words (English identifiers kept). */
  requires?: string[];
  /** Whether the end user must connect / authorise their own account. */
  userConnectRequired?: boolean;
}

export interface ParsedProfileInput {
  platform: Platform;
  /** Normalised handle, lower-cased for Instagram, as-entered-case for Facebook. */
  identifier: string;
  /** Canonical public URL rebuilt from the identifier (never the raw user URL). */
  canonicalUrl: string;
  /** "username" | "url" — how the user supplied the value. */
  inputKind: "username" | "url";
}

/**
 * One result model shared by every provider operation so the UI can render
 * the right state without inspecting platform-specific errors.
 */
export type ProviderResult<T> =
  | { kind: "ok"; data: T; fetchedAt: string; source: string }
  | { kind: "invalid-input"; reason: InvalidInputReason }
  | { kind: "unsupported"; capability: Capability["id"] }
  | { kind: "not-configured"; missing: string[] }
  | { kind: "unauthorized" }
  | { kind: "rate-limited"; retryAfterSeconds?: number }
  | { kind: "not-found" }
  | { kind: "unavailable" };

export type InvalidInputReason =
  | "empty"
  | "too-long"
  | "bad-url"
  | "wrong-host"
  | "platform-mismatch"
  | "not-a-profile-path"
  | "bad-username";
