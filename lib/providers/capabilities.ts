import type { Capability, CapabilityId, Platform } from "./types";

const SOURCES = {
  businessDiscovery:
    "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery",
  instagramApi:
    "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login",
  pagePublicContent: "https://developers.facebook.com/docs/features-reference/page-public-content-access",
  pagesApi: "https://developers.facebook.com/docs/pages-api/overview",
  platformTerms: "https://developers.facebook.com/terms",
  automatedCollection: "https://developers.facebook.com/terms/dfc_platform_terms",
} as const;

const EXPLANATIONS: Record<CapabilityId, string> = {
  "parse-input":
    "Anoneye normalises profile links and usernames locally. No network request is made and nothing is stored.",
  "profile-lookup":
    "Requires a Meta app with the documented permissions, plus a connected Instagram professional account (Business Discovery) or Page access for Facebook Pages.",
  "public-media":
    "Only media the official API returns for public professional accounts/Pages is listed. Meta may omit media URLs for licensed audio.",
  "metrics-history":
    "History is built from snapshots Anoneye records on successful syncs; it never estimates earlier values.",
  stories:
    "Other accounts' Stories are not exposed by the official APIs. Anoneye does not bypass that and cannot hide story views.",
  "media-download":
    "No authorised endpoint exists for downloading third-party photos or reels. Anoneye links to the original post instead of proxying or rehosting media.",
  "visitor-identity":
    "Meta does not expose who viewed a profile or a story through any API. No legitimate tool can provide it.",
};

function capability(platform: Platform, id: CapabilityId, status: Capability["status"]): Capability {
  const base: Capability = { id, status, explanationKey: id };
  if (id === "parse-input") {
    return { ...base, sourceUrl: platform === "instagram" ? SOURCES.instagramApi : SOURCES.pagesApi };
  }
  if (id === "profile-lookup") {
    return {
      ...base,
      userConnectRequired: platform === "instagram",
      requires:
        platform === "instagram"
          ? [
              "Meta app with Instagram API with Facebook Login",
              "instagram_basic, instagram_manage_insights, pages_read_engagement",
              "A connected Instagram professional account (Business or Creator)",
              "The target must also be an Instagram professional account",
            ]
          : [
              "A Meta app with Facebook Login",
              "Page Public Content Access (App Review + business verification) for arbitrary public Pages",
              "Page access token for Pages the user manages",
            ],
      sourceUrl: platform === "instagram" ? SOURCES.businessDiscovery : SOURCES.pagePublicContent,
    };
  }
  if (id === "public-media") {
    return {
      ...base,
      userConnectRequired: true,
      requires:
        platform === "instagram"
          ? ["Business Discovery media edge", "Media URLs may be withheld by Meta for licensed audio"]
          : ["Page Public Content Access, or a Page role for managed Pages", "pages_read_engagement"],
      sourceUrl: platform === "instagram" ? SOURCES.instagramApi : SOURCES.pagePublicContent,
    };
  }
  if (id === "metrics-history") {
    return {
      ...base,
      userConnectRequired: true,
      requires: ["A working profile lookup", "Stored timestamped snapshots", "A scheduler for automatic sync"],
      sourceUrl: platform === "instagram" ? SOURCES.businessDiscovery : SOURCES.pagesApi,
    };
  }
  if (id === "stories") {
    return { ...base, sourceUrl: platform === "instagram" ? SOURCES.instagramApi : SOURCES.pagesApi };
  }
  if (id === "media-download") {
    return { ...base, sourceUrl: SOURCES.platformTerms };
  }
  return { ...base, sourceUrl: SOURCES.automatedCollection };
}

function build(platform: Platform): Capability[] {
  return [
    capability(platform, "parse-input", "available"),
    capability(platform, "profile-lookup", "requires-config"),
    capability(platform, "public-media", "requires-config"),
    capability(platform, "metrics-history", "requires-config"),
    capability(platform, "stories", "unsupported"),
    capability(platform, "media-download", "unsupported"),
    capability(platform, "visitor-identity", "unsupported"),
  ];
}

export const CAPABILITIES: Record<Platform, Capability[]> = {
  instagram: build("instagram"),
  facebook: build("facebook"),
};

export function getCapability(platform: Platform, id: CapabilityId): Capability {
  return (
    CAPABILITIES[platform].find((entry) => entry.id === id) ?? {
      id,
      status: "unverified",
      explanationKey: id,
    }
  );
}

export function explainCapability(id: CapabilityId): string {
  return EXPLANATIONS[id];
}

/** Names of environment variables needed for live lookups (never values). */
export const REQUIRED_ENV_FOR_LOOKUP = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export const REQUIRED_ENV_SERVER_TOKEN = ["META_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ID"] as const;
