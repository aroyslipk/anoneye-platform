import { parseProfileInput } from "./parse";
import { CAPABILITIES, explainCapability } from "./capabilities";
import type {
  CapabilityId,
  MediaItem,
  ParsedProfileInput,
  Platform,
  ProviderResult,
  ProviderRuntimeContext,
  PublicProfile,
  SocialProvider,
} from "./types";

/**
 * Explicit demo fixtures.
 *
 * This provider is only reachable when ANONEYE_DEMO_MODE is enabled AND the
 * identifier is one of DEMO_IDS. Fixture numbers are synthetic, media is
 * local SVG artwork, and every surface that renders them carries a "sample"
 * badge. Real identifiers never resolve here.
 */

export const DEMO_IDS = ["anoneye.demo"] as const;
const DEMO_IDENTIFIER = DEMO_IDS[0];

export function isDemoIdentifier(platform: Platform, identifier: string): boolean {
  void platform;
  return identifier === DEMO_IDENTIFIER;
}

function media(platform: Platform): MediaItem[] {
  if (platform === "instagram") {
    return Array.from({ length: 6 }, (_, index) => ({
      id: `demo-ig-${index + 1}`,
      type: index === 2 ? "carousel" : index === 4 ? "video" : "image",
      thumbnailUrl: `/demo/media-${index + 1}.svg`,
      mediaUrl: `/demo/media-${index + 1}.svg`,
      permalink: undefined,
      timestamp: new Date(Date.UTC(2026, 8, 4 + index * 3, 9, 30)).toISOString(),
      caption: `Sample caption ${index + 1} — synthetic demo media, not a real post.`,
      likeCount: [412, 388, 502, 274, 631, 356][index],
      commentsCount: [18, 9, 24, 6, 31, 12][index],
      retrievalStatus: "listed" as const,
    }));
  }
  return Array.from({ length: 4 }, (_, index) => ({
    id: `demo-fb-${index + 1}`,
    type: index === 1 ? "video" : "image",
    thumbnailUrl: `/demo/fb-${index + 1}.svg`,
    mediaUrl: `/demo/fb-${index + 1}.svg`,
    permalink: undefined,
    timestamp: new Date(Date.UTC(2026, 8, 6 + index * 5, 8, 15)).toISOString(),
    caption: `Sample Page post ${index + 1} — synthetic demo media, not a real post.`,
    likeCount: [204, 318, 147, 265][index],
    commentsCount: [11, 24, 4, 16][index],
    retrievalStatus: "listed" as const,
  }));
}

export function demoProfile(platform: Platform): PublicProfile {
  const isInstagram = platform === "instagram";
  return {
    platform,
    identifier: DEMO_IDENTIFIER,
    username: DEMO_IDENTIFIER,
    displayName: isInstagram ? "Anoneye Demo Studio" : "Anoneye Demo Page",
    biography:
      "Synthetic fixture used to preview the Anoneye interface. This is not a real social-media profile and the metrics are not observations of any account.",
    profilePictureUrl: isInstagram ? "/demo/avatar-ig.svg" : "/demo/avatar-fb.svg",
    website: undefined,
    accountKind: isInstagram ? "professional" : "page",
    canonicalUrl: isInstagram
      ? `https://www.instagram.com/${DEMO_IDENTIFIER}/`
      : `https://www.facebook.com/${DEMO_IDENTIFIER}`,
    metrics: isInstagram
      ? { followers: 12480, following: 318, mediaCount: 6 }
      : { followers: 8420, mediaCount: 4 },
    media: media(platform),
    mediaHasMore: false,
    limitations: ["demo-fixture", "stories-not-supported", "verification-not-returned"],
    source: "Anoneye demo fixture (synthetic data, not a live observation)",
    fetchedAt: new Date().toISOString(),
    demo: true,
  };
}

function makeDemoProvider(platform: Platform): SocialProvider {
  return {
    platform,
    getCapabilities() {
      return CAPABILITIES[platform];
    },
    parseInput(rawInput) {
      return parseProfileInput(platform, rawInput);
    },
    isConfigured() {
      return true;
    },
    missingConfig() {
      return [];
    },
    async lookupProfile(input: ParsedProfileInput, _context: ProviderRuntimeContext): Promise<ProviderResult<PublicProfile>> {
      void _context;
      if (!isDemoIdentifier(platform, input.identifier)) {
        return { kind: "not-found", source: "demo fixture" };
      }
      const profile = demoProfile(platform);
      return { kind: "ok", data: profile, source: profile.source, fetchedAt: profile.fetchedAt };
    },
    getAvailabilityExplanation(id: CapabilityId) {
      return explainCapability(id);
    },
  };
}

export const demoProvider = makeDemoProvider("instagram");
export const demoFacebookProvider = makeDemoProvider("facebook");
