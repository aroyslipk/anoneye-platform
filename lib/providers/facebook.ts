import "server-only";
import { getEnv, isMetaServerTokenConfigured } from "@/lib/env";
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
  ProfileLimitation,
  ProviderResult,
  ProviderRuntimeContext,
  PublicProfile,
  SocialProvider,
} from "./types";

/**
 * Facebook Pages through the Graph API.
 *
 * Public Page metadata is available for Pages the token can read. Page posts
 * require Page Public Content Access (App Review + business verification) or a
 * Page role; without it Anoneye still shows the metadata the API returned and
 * states that posts are unavailable.
 */

const PAGE_FIELDS = "id,name,username,about,fan_count,followers_count,link,website,picture.type(large)";
const POST_FIELDS =
  "id,message,created_time,permalink_url,full_picture,attachments{media_type,media{image{src}}},shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)";
const POST_LIMIT = 12;

interface FbPicture {
  data?: { url?: unknown; is_silhouette?: unknown };
}

interface FbPost {
  id?: unknown;
  message?: unknown;
  created_time?: unknown;
  permalink_url?: unknown;
  full_picture?: unknown;
  attachments?: { data?: { media_type?: unknown; media?: { image?: { src?: unknown } } }[] };
  comments?: { summary?: { total_count?: unknown } };
  reactions?: { summary?: { total_count?: unknown } };
}

interface FbPage {
  id?: unknown;
  name?: unknown;
  username?: unknown;
  about?: unknown;
  fan_count?: unknown;
  followers_count?: unknown;
  link?: unknown;
  website?: unknown;
  picture?: FbPicture;
}

interface FbPostsResponse {
  data?: unknown;
  paging?: { cursors?: { after?: unknown } };
}

function asMetric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function toIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function postsResponseToMedia(response: FbPostsResponse): { media: MediaItem[]; hasMore: boolean } {
  const data = Array.isArray(response.data) ? (response.data as FbPost[]) : [];
  const media = data.slice(0, POST_LIMIT).map((post): MediaItem => {
    const attachment = post.attachments?.data?.[0];
    const attachmentImage = safeMediaUrl(attachment?.media?.image?.src);
    const picture = safeMediaUrl(post.full_picture) ?? attachmentImage;
    const mediaType = typeof attachment?.media_type === "string" ? attachment.media_type.toLowerCase() : "";
    return {
      id: typeof post.id === "string" ? post.id : "",
      type: mediaType.includes("video") ? "video" : mediaType.includes("album") || mediaType.includes("photo") ? "image" : "unknown",
      thumbnailUrl: picture,
      mediaUrl: picture,
      permalink: safePermalink("facebook", post.permalink_url),
      timestamp: toIso(post.created_time),
      caption: safeCaption(post.message),
      likeCount: asMetric(post.reactions?.summary?.total_count),
      commentsCount: asMetric(post.comments?.summary?.total_count),
      retrievalStatus: picture ? "listed" : "unavailable",
    };
  }).filter((item) => item.id.length > 0);

  const after = response.paging?.cursors?.after;
  return { media, hasMore: typeof after === "string" || data.length >= POST_LIMIT };
}

export const facebookProvider: SocialProvider = {
  platform: "facebook",

  getCapabilities() {
    return CAPABILITIES.facebook;
  },

  parseInput(rawInput) {
    return parseProfileInput("facebook", rawInput);
  },

  isConfigured(context) {
    const env = getEnv();
    return Boolean(
      context.pageAccessToken ||
        context.accessToken ||
        context.serverAccessToken ||
        env.FACEBOOK_PAGE_ACCESS_TOKEN ||
        env.META_ACCESS_TOKEN,
    );
  },

  missingConfig() {
    if (!isMetaServerTokenConfigured()) {
      return ["META_ACCESS_TOKEN or FACEBOOK_PAGE_ACCESS_TOKEN", "a connected Facebook Page"];
    }
    return ["Page Public Content Access for Pages you do not manage"];
  },

  async lookupProfile(
    input: ParsedProfileInput,
    context: ProviderRuntimeContext,
  ): Promise<ProviderResult<PublicProfile>> {
    const env = getEnv();
    const accessToken =
      context.pageAccessToken ??
      context.accessToken ??
      context.serverAccessToken ??
      env.FACEBOOK_PAGE_ACCESS_TOKEN ??
      env.META_ACCESS_TOKEN;
    const source = graphSourceLabel();

    if (!accessToken) {
      return {
        kind: "not-configured",
        missing: [
          "A Meta app with Facebook Login and Page Public Content Access",
          "META_ACCESS_TOKEN / FACEBOOK_PAGE_ACCESS_TOKEN or a connected Facebook Page",
        ],
      };
    }

    let page: FbPage;
    try {
      page = await graphFetch<FbPage>({
        path: input.identifier,
        params: { fields: PAGE_FIELDS },
        accessToken,
        signal: context.signal,
      });
    } catch (error) {
      return providerFailure(error, source);
    }

    if (!page || typeof page.id !== "string") return { kind: "not-found", source };

    const limitations: ProfileLimitation[] = ["stories-not-supported", "verification-not-returned"];
    let media: MediaItem[] = [];
    let mediaHasMore = false;

    try {
      const posts = await graphFetch<FbPostsResponse>({
        path: `${page.id}/posts`,
        params: { fields: POST_FIELDS, limit: POST_LIMIT },
        accessToken,
        signal: context.signal,
      });
      const mapped = postsResponseToMedia(posts);
      media = mapped.media;
      mediaHasMore = mapped.hasMore;
      if (mapped.hasMore) limitations.push("media-list-limited");
    } catch (error) {
      if (error instanceof GraphApiError && error.kind === "rate-limited") {
        return providerFailure(error, source);
      }
      // Missing posts permission is a documented limitation, not a failure of
      // the profile lookup itself. Show the Page metrics that were returned.
      limitations.push("page-posts-need-approval");
    }

    const picture = safeMediaUrl(page.picture?.data?.url);
    if (!picture) limitations.push("profile-image-may-be-missing");

    const canonical =
      safePermalink("facebook", page.link) ?? input.canonicalUrl;

    const profile: PublicProfile = {
      platform: "facebook",
      identifier: input.identifier,
      username: typeof page.username === "string" && page.username ? page.username : input.identifier,
      displayName: typeof page.name === "string" && page.name.trim() ? page.name : undefined,
      biography: safeCaption(page.about),
      profilePictureUrl: picture,
      website: typeof page.website === "string" && /^https?:\/\//i.test(page.website) ? page.website.slice(0, 2048) : undefined,
      accountKind: "page",
      canonicalUrl: canonical,
      metrics: {
        // `fan_count` (Page likes) is deliberately NOT reported as followers.
        followers: asMetric(page.followers_count),
        mediaCount: undefined,
      },
      media,
      mediaHasMore,
      limitations,
      source: `Facebook Pages API · ${source}`,
      fetchedAt: new Date().toISOString(),
      demo: false,
    };

    return { kind: "ok", data: profile, source: profile.source, fetchedAt: profile.fetchedAt };
  },

  getAvailabilityExplanation(id: CapabilityId) {
    return explainCapability(id);
  },
};
