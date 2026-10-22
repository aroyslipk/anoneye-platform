import type { InvalidInputReason, ParsedProfileInput, Platform } from "./types";

/**
 * Strict, allow-list based parsing of profile URLs and usernames.
 * Pure function: safe to run in the browser and on the server.
 *
 * Deliberately conservative: anything that is not clearly a public
 * profile reference is rejected rather than guessed.
 */

const MAX_INPUT_LENGTH = 200;

const HOSTS: Record<Platform, ReadonlySet<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]),
  facebook: new Set([
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.com",
    "www.fb.com",
  ]),
};

/** Reserved first path segments that are never profiles. */
const RESERVED: Record<Platform, ReadonlySet<string>> = {
  instagram: new Set([
    "p", "reel", "reels", "stories", "explore", "accounts", "direct",
    "about", "legal", "developer", "tv", "api", "web", "ar", "nametag",
  ]),
  facebook: new Set([
    "profile.php", "groups", "events", "pages", "marketplace", "watch",
    "gaming", "login", "help", "policies", "privacy", "settings", "photo",
    "photo.php", "share", "sharer", "reel", "stories", "story.php", "people",
    "hashtag", "search", "friends", "messages", "notifications", "bookmarks",
  ]),
};

// Instagram: 1–30 chars, letters/digits/underscore/period, no leading/trailing or doubled periods.
const IG_USERNAME = /^(?!.*\.\.)(?!\.)[a-z0-9._]{1,30}(?<!\.)$/i;
// Facebook vanity names: 5–50 chars, letters/digits/period, cannot be only digits.
const FB_USERNAME = /^(?=.*[a-z])(?!.*\.\.)(?!\.)[a-z0-9.]{5,50}(?<!\.)$/i;

export type ParseOutcome =
  | { ok: true; value: ParsedProfileInput }
  | { ok: false; reason: InvalidInputReason };

export function canonicalProfileUrl(platform: Platform, identifier: string): string {
  return platform === "instagram"
    ? `https://www.instagram.com/${identifier}/`
    : `https://www.facebook.com/${identifier}`;
}

export function validateUsername(platform: Platform, raw: string): ParseOutcome {
  const handle = raw.trim().replace(/^@/, "");
  if (handle.length === 0) return { ok: false, reason: "empty" };
  if (handle.length > MAX_INPUT_LENGTH) return { ok: false, reason: "too-long" };
  const re = platform === "instagram" ? IG_USERNAME : FB_USERNAME;
  if (!re.test(handle)) return { ok: false, reason: "bad-username" };
  if (RESERVED[platform].has(handle.toLowerCase())) return { ok: false, reason: "bad-username" };
  // Both platforms treat profile handles case-insensitively; normalising here
  // prevents duplicate tracked rows that differ only by case.
  const identifier = handle.toLowerCase();
  return {
    ok: true,
    value: {
      platform,
      identifier,
      canonicalUrl: canonicalProfileUrl(platform, identifier),
      inputKind: "username",
    },
  };
}

function detectPlatformFromHost(host: string): Platform | null {
  if (HOSTS.instagram.has(host)) return "instagram";
  if (HOSTS.facebook.has(host)) return "facebook";
  return null;
}

/**
 * Parse a username or profile URL for the selected platform.
 * If the input is a URL for a different allow-listed platform, we report a
 * platform mismatch instead of silently switching.
 */
export function parseProfileInput(platform: Platform, rawInput: string): ParseOutcome {
  const input = rawInput.trim();
  if (input.length === 0) return { ok: false, reason: "empty" };
  if (input.length > MAX_INPUT_LENGTH) return { ok: false, reason: "too-long" };
  // Reject every non-HTTP scheme early (javascript:, data:, file:, …) instead
  // of letting it fall through to the username validator.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(input);
  if (scheme && !/^https?$/i.test(scheme[1])) return { ok: false, reason: "bad-url" };

  const looksLikeUrl = /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|net)\b)/i.test(input) || input.includes("/");
  if (!looksLikeUrl) return validateUsername(platform, input);

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: "bad-url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "bad-url" };
  if (url.username || url.password || url.port) return { ok: false, reason: "bad-url" };

  const host = url.hostname.toLowerCase();
  const detected = detectPlatformFromHost(host);
  if (!detected) return { ok: false, reason: "wrong-host" };
  if (detected !== platform) return { ok: false, reason: "platform-mismatch" };

  const segments = url.pathname.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (segments.length === 0) return { ok: false, reason: "not-a-profile-path" };

  const first = segments[0];
  if (RESERVED[platform].has(first.toLowerCase())) return { ok: false, reason: "not-a-profile-path" };
  // Only a bare /{handle}/ (optionally followed by a known sub-tab) counts as a profile.
  const allowedTail = platform === "instagram"
    ? new Set(["reels", "tagged", "saved"])
    : new Set(["about", "photos", "videos", "reels", "posts"]);
  if (segments.length > 2) return { ok: false, reason: "not-a-profile-path" };
  if (segments.length === 2 && !allowedTail.has(segments[1].toLowerCase())) {
    return { ok: false, reason: "not-a-profile-path" };
  }

  const result = validateUsername(platform, first);
  if (!result.ok) return result;
  return { ok: true, value: { ...result.value, inputKind: "url" } };
}

/** Try both platforms when the user has not chosen one (used for URL auto-detect). */
export function detectPlatform(rawInput: string): Platform | null {
  const input = rawInput.trim();
  if (!input.includes(".") && !input.includes("/")) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return detectPlatformFromHost(url.hostname.toLowerCase());
  } catch {
    return null;
  }
}
