import "server-only";
import { getEnv, isMetaOAuthConfigured, isMetaServerTokenConfigured } from "@/lib/env";
import {
  GraphApiError,
  graphFetch,
  graphSourceLabel,
  providerFailure,
  safeCaption,
  safeMediaUrl,
  safePermalink,
} from "./graph";
import { parseProfileInput } from "./parse";
import { CAPABILITIES, explainCapability } from "./capabilities";
import type {
  CapabilityId,
  MediaItem,
  ParsedProfileInput,
  ProviderResult,
  ProviderRuntimeContext,
  PublicProfile,
  SocialProvider,
  ProfileLimitation,
} from "./types";

/**
 * Instagram via Business Discovery (Instagram API with Facebook Login).
 *
 * Documented constraints (verified against Meta docs, see docs/API_CAPABILITIES.md):
 * - the query runs on the app user's own professional account id
 * - only Business/Creator accounts can be discovered; personal accounts cannot
 * - media pagination is cursor-based; only recent media is returned
 * - `media_url` may be omitted for licensed audio / disabled downloads
 */

const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
const MEDIA_LIMIT = 12;

const PRIMARY_FIELDS = [
  "id",
  "username",
  "name",
  "biography",
  "followers_count",
  "follows_count",
  "media_count",
  "profile_picture_url",
  "website",
  `media.limit(${MEDIA_LIMIT}){${MEDIA_FIELDS}}`,
].join(",");

const FALLBACK_FIELDS = [
  "id",
  "username",
  "biography",
  "followers_count",
  "media_count",
  "website",
  `media.limit(${MEDIA_LIMIT}){${MEDIA_FIELDS}}`,
].join(",");

interface IgMedia {
  id?: unknown;
  caption?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
  timestamp?: unknown;
  like_count?: unknown;
  comments_count?: unknown;
}

interface IgBusinessDiscovery {
  id?: unknown;
  username?: unknown;
  name?: unknown;
  biography?: unknown;
  followers_count?: unknown;
  follows_count?: unknown;
  media_count?: unknown;
  profile_picture_url?: unknown;
  website?: unknown;
  media?: {
    data?: unknown;
    paging?: { cursors?: { after?: unknown } };
  };
}

interface IgResponse {
  business_discovery?: IgBusinessDiscovery;
}

function asMetric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function mapMediaType(value: unknown): MediaItem["type"] {
  if (value === "IMAGE") return "image";
  if (value === "VIDEO") return "video";
  if (value === "CAROUSEL_ALBUM") return "carousel";
  return "unknown";
}

function toTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function isUnknownFieldError(error: unknown): boolean {
  if (!(error instanceof GraphApiError) || error.kind !== "invalid") return false;
  const message = error.message.toLowerCase();
  return message.includes("code 100");
}

function mediaFrom(discovery: IgBusinessDiscovery): { media: MediaItem[]; hasMore: boolean; omittedUrl: boolean } {
  const data = Array.isArray(discovery.media?.data) ? (discovery.media.data as IgMedia[]) : [];
  let omittedUrl = false;
  const media = data.slice(0, MEDIA_LIMIT).map((raw): MediaItem => {
    const type = mapMediaType(raw.media_type);
    const mediaUrl = safeMediaUrl(raw.media_url);
    const thumbnail = safeMediaUrl(raw.thumbnail_url) ?? mediaUrl;
    if (raw.media_url !== undefined && raw.media_url !== null && !mediaUrl) omittedUrl = true;
    return {
      id: typeof raw.id === "string" ? raw.id : "",
      type,
      thumbnailUrl: thumbnail,
      mediaUrl,
      permalink: safePermalink("instagram", raw.permalink),
      timestamp: toTimestamp(raw.timestamp),
      caption: safeCaption(raw.caption),
      likeCount: asMetric(raw.like_count),
      commentsCount: asMetric(raw.comments_count),
      retrievalStatus: thumbnail || mediaUrl ? "listed" : "unavailable",
    };
  }).filter((item) => item.id.length > 0);

  const after = discovery.media?.paging?.cursors?.after;
  return {
    media,
    hasMore: typeof after === "string" || data.length >= MEDIA_LIMIT,
    omittedUrl,
  };
}

export const instagramProvider: SocialProvider = {
  platform: "instagram",

  getCapabilities() {
    return CAPABILITIES.instagram;
  },

  parseInput(rawInput) {
    return parseProfileInput("instagram", rawInput);
  },

  isConfigured(context) {
    const env = getEnv();
    const hasUserToken = Boolean(context.accessToken && context.instagramBusinessId);
    const hasServerToken = Boolean(env.META_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ID);
    return hasUserToken || hasServerToken;
  },

  missingConfig() {
    if (!isMetaOAuthConfigured() && !isMetaServerTokenConfigured()) {
      return ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"];
    }
    return ["INSTAGRAM_BUSINESS_ID (or a connected Instagram professional account)"];
  },

  async lookupProfile(
    input: ParsedProfileInput,
    context: ProviderRuntimeContext,
  ): Promise<ProviderResult<PublicProfile>> {
    const env = getEnv();
    const accessToken = context.accessToken ?? env.META_ACCESS_TOKEN;
    const accountId = context.instagramBusinessId ?? env.INSTAGRAM_BUSINESS_ID;
    const source = graphSourceLabel();

    if (!accessToken || !accountId) {
      return {
        kind: "not-configured",
        missing: [
          "Meta app credentials (META_APP_ID / META_APP_SECRET / META_REDIRECT_URI)",
          "INSTAGRAM_BUSINESS_ID or a connected Instagram professional account",
        ],
      };
    }

    const build = (fields: string) =>
      `business_discovery.username(${input.identifier}){${fields}}`;

    let discovery: IgBusinessDiscovery | undefined;
    try {
      const primary = await graphFetch<IgResponse>({
        path: accountId,
        params: { fields: build(PRIMARY_FIELDS) },
        accessToken,
        signal: context.signal,
      });
      discovery = primary.business_discovery;
    } catch (error) {
      if (!isUnknownFieldError(error)) return providerFailure(error, source);
      try {
        const fallback = await graphFetch<IgResponse>({
          path: accountId,
          params: { fields: build(FALLBACK_FIELDS) },
          accessToken,
          signal: context.signal,
        });
        discovery = fallback.business_discovery;
      } catch (fallbackError) {
        return providerFailure(fallbackError, source);
      }
    }

    if (!discovery || typeof discovery.id !== "string") {
      return { kind: "not-found", source };
    }

    const { media, hasMore, omittedUrl } = mediaFrom(discovery);
    const limitations: ProfileLimitation[] = [
      "stories-not-supported",
      "personal-accounts-not-supported",
      "target-must-be-professional",
    ];
    if (typeof discovery.follows_count !== "number") limitations.push("following-not-public");
    if (!safeMediaUrl(discovery.profile_picture_url)) limitations.push("profile-image-may-be-missing");
    if (omittedUrl) limitations.push("media-url-may-be-omitted");
    if (hasMore) limitations.push("media-list-limited");
    limitations.push("verification-not-returned");

    const metrics = {
      followers: asMetric(discovery.followers_count),
      following: asMetric(discovery.follows_count),
      mediaCount: asMetric(discovery.media_count),
    };

    const profile: PublicProfile = {
      platform: "instagram",
      identifier: input.identifier,
      username: typeof discovery.username === "string" ? discovery.username : input.identifier,
      displayName: typeof discovery.name === "string" && discovery.name.trim() ? discovery.name : undefined,
      biography: safeCaption(discovery.biography),
      profilePictureUrl: safeMediaUrl(discovery.profile_picture_url),
      website: typeof discovery.website === "string" && /^https?:\/\//i.test(discovery.website) ? discovery.website.slice(0, 2048) : undefined,
      accountKind: "professional",
      canonicalUrl: input.canonicalUrl,
      metrics,
      media,
      mediaHasMore: hasMore,
      limitations,
      source: `Instagram Business Discovery · ${source}`,
      fetchedAt: new Date().toISOString(),
      demo: false,
    };

    return { kind: "ok", data: profile, source: profile.source, fetchedAt: profile.fetchedAt };
  },

  getAvailabilityExplanation(id: CapabilityId) {
    return explainCapability(id);
  },
};

