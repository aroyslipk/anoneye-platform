/**
 * Provider abstraction: everything the app knows about a social platform goes
 * through this contract. No page or route talks to Meta directly.
 *
 * The layer is deliberately explicit about what each platform does *not*
 * return. Missing metrics are `undefined` (never 0), and every limitation is a
 * stable code the UI can translate.
 */

export const PLATFORMS = ["instagram", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

export type CapabilityId =
  | "parse-input"
  | "profile-lookup"
  | "public-media"
  | "metrics-history"
  | "stories"
  | "media-download"
  | "visitor-identity";

/** Honest state of a capability, checked against current Meta documentation. */
export type CapabilityStatus =
  | "available" // works with no third-party credentials
  | "requires-config" // documented API supports it; deployment needs credentials/permissions
  | "unverified" // not verified against current docs; kept disabled
  | "unsupported"; // not offered by the official API; never simulated

export interface Capability {
  id: CapabilityId;
  status: CapabilityStatus;
  /** Human-readable prerequisite list (technical identifiers stay in English). */
  requires?: string[];
  /** True when the end user must connect their own account. */
  userConnectRequired?: boolean;
  /** Optional key for localised explanation. */
  explanationKey?: string;
  /** Official documentation used to verify the claim. */
  sourceUrl?: string;
}

export interface ParsedProfileInput {
  platform: Platform;
  /** Normalised handle: lower-cased, because profiles are case-insensitive. */
  identifier: string;
  /** Canonical public URL rebuilt from the handle (never the raw user URL). */
  canonicalUrl: string;
  inputKind: "username" | "url";
}

export type InvalidInputReason =
  | "empty"
  | "too-long"
  | "bad-url"
  | "wrong-host"
  | "platform-mismatch"
  | "not-a-profile-path"
  | "bad-username";

export type ParseOutcome =
  | { ok: true; value: ParsedProfileInput }
  | { ok: false; reason: InvalidInputReason };

export type MetricKey = "followers" | "following" | "mediaCount";

/** Only metrics the provider actually returned are present. */
export type MetricSet = Partial<Record<MetricKey, number>>;

export type MediaType = "image" | "video" | "carousel" | "unknown";

export interface MediaItem {
  /** Provider media id. */
  id: string;
  type: MediaType;
  /** Direct image URL from the provider CDN (never proxied by Anoneye). */
  thumbnailUrl?: string;
  /** Direct video/image URL when the provider supplies one. */
  mediaUrl?: string;
  permalink?: string;
  /** ISO timestamp from the provider. */
  timestamp?: string;
  caption?: string;
  likeCount?: number;
  commentsCount?: number;
  /** "expired" when a previously stored URL is known to have expired. */
  retrievalStatus: "listed" | "unavailable" | "expired";
}

/**
 * Stable limitation codes. Rendering code maps them to Bangla/English text;
 * nothing is invented to fill a gap.
 */
export type ProfileLimitation =
  | "target-must-be-professional"
  | "personal-accounts-not-supported"
  | "age-gated-not-returned"
  | "stories-not-supported"
  | "media-url-may-be-omitted"
  | "media-list-limited"
  | "following-not-public"
  | "profile-image-may-be-missing"
  | "page-posts-need-approval"
  | "verification-not-returned"
  | "demo-fixture";

export interface PublicProfile {
  platform: Platform;
  identifier: string;
  /** Handle returned by the provider (may differ in case). */
  username: string;
  displayName?: string;
  biography?: string;
  profilePictureUrl?: string;
  website?: string;
  /** "page" for Facebook Pages, "professional" for Instagram Business Discovery. */
  accountKind: "professional" | "page" | "unknown";
  /** Only set when the provider documents this field; otherwise omitted. */
  verified?: boolean;
  canonicalUrl: string;
  metrics: MetricSet;
  media: MediaItem[];
  /** True when the provider indicates more media exists than was returned. */
  mediaHasMore: boolean;
  limitations: ProfileLimitation[];
  /** Human-readable data-source label, e.g. "Instagram Graph API (v26.0)". */
  source: string;
  /** ISO timestamp when this observation was fetched. */
  fetchedAt: string;
  /** True only for the explicitly enabled fixture provider. */
  demo: boolean;
}

/** One uniform result model for every provider operation. */
export type ProviderResult<T> =
  | { kind: "ok"; data: T; source: string; fetchedAt: string }
  | { kind: "invalid-input"; reason: InvalidInputReason }
  | { kind: "not-configured"; missing: string[] }
  | { kind: "unauthorized"; source: string }
  | { kind: "rate-limited"; source: string; retryAfterSeconds?: number }
  | { kind: "not-found"; source: string }
  | { kind: "unsupported"; capability: CapabilityId }
  | { kind: "unavailable"; source: string };

export interface ProviderRuntimeContext {
  /** Decrypted OAuth access token (user or Page token). Never logged. */
  accessToken?: string;
  /** Instagram professional account id used as the Business Discovery subject. */
  instagramBusinessId?: string;
  /** Facebook Page id + Page token for Pages the user manages. */
  pageId?: string;
  pageAccessToken?: string;
  /** Deployment-level token (owner-configured) for public Page reads. */
  serverAccessToken?: string;
  /** Request abort signal. */
  signal?: AbortSignal;
}

export interface SocialProvider {
  readonly platform: Platform;
  /** Capability matrix verified against official documentation. */
  getCapabilities(): Capability[];
  /** Strict input parsing for this platform. */
  parseInput(rawInput: string): ParseOutcome;
  /** Whether this deployment has what the provider needs for a lookup. */
  isConfigured(context: ProviderRuntimeContext): boolean;
  /** Secret-free names of missing configuration. */
  missingConfig(): string[];
  lookupProfile(
    input: ParsedProfileInput,
    context: ProviderRuntimeContext,
  ): Promise<ProviderResult<PublicProfile>>;
  /** Human-readable explanation for unsupported/unverified capabilities. */
  getAvailabilityExplanation(id: CapabilityId): string | undefined;
}
