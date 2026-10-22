import type { Capability, Platform } from "./types";

/**
 * Honest capability declarations per platform.
 *
 * These describe what Anoneye can do TODAY in this deployment, not what the
 * platforms could theoretically offer. Statuses are intentionally
 * conservative: nothing is marked "available" unless it runs without
 * external credentials, and nothing is marked "requires-config" unless the
 * official API is documented to support it for the stated account type.
 * Items that still need a documentation check are "unverified" and stay
 * disabled. Full write-up: docs/API_CAPABILITIES.md (milestone 2).
 */
export const CAPABILITIES: Record<Platform, Capability[]> = {
  instagram: [
    { id: "parse-input", status: "available" },
    {
      id: "profile-lookup",
      status: "requires-config",
      requires: [
        "Meta app + Instagram Graph API",
        "Instagram professional (Business/Creator) account linked to a Facebook Page",
        "instagram_basic, instagram_manage_insights",
        "Target must also be a professional account (Business Discovery)",
      ],
      userConnectRequired: true,
    },
    {
      id: "public-media",
      status: "requires-config",
      requires: ["Business Discovery media edge", "Target professional account"],
      userConnectRequired: true,
    },
    { id: "metrics-history", status: "requires-config", requires: ["Scheduled sync + stored snapshots"], userConnectRequired: true },
    { id: "stories", status: "unsupported" },
    { id: "media-download", status: "unverified" },
    { id: "visitor-identity", status: "unsupported" },
  ],
  facebook: [
    { id: "parse-input", status: "available" },
    {
      id: "profile-lookup",
      status: "requires-config",
      requires: [
        "Meta app + Graph API",
        "Page Public Content Access (App Review) or a Page the user manages",
        "pages_read_engagement for managed Pages",
      ],
      userConnectRequired: true,
    },
    { id: "public-media", status: "unverified" },
    { id: "metrics-history", status: "requires-config", requires: ["Scheduled sync + stored snapshots"], userConnectRequired: true },
    { id: "stories", status: "unsupported" },
    { id: "media-download", status: "unverified" },
    { id: "visitor-identity", status: "unsupported" },
  ],
};

export function getCapability(platform: Platform, id: Capability["id"]): Capability {
  return CAPABILITIES[platform].find((c) => c.id === id) ?? { id, status: "unverified" };
}

/** Which credential names the owner must configure before live lookups work. */
export const REQUIRED_ENV_FOR_LOOKUP = ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"] as const;
