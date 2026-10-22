import { describe, expect, it } from "vitest";
import { canonicalProfileUrl, detectPlatform, parseProfileInput, validateUsername } from "@/lib/providers/parse";

function ok(platform: "instagram" | "facebook", input: string) {
  const result = parseProfileInput(platform, input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected a parse success for ${input}`);
  return result.value;
}

function reason(platform: "instagram" | "facebook", input: string) {
  const result = parseProfileInput(platform, input);
  expect(result.ok).toBe(false);
  return result.ok ? "unexpected-success" : result.reason;
}

describe("parseProfileInput / usernames", () => {
  it("normalises handles: trims, strips @, lowercases", () => {
    const parsed = ok("instagram", "  @NASA  ");
    expect(parsed.identifier).toBe("nasa");
    expect(parsed.canonicalUrl).toBe("https://www.instagram.com/nasa/");
    expect(parsed.inputKind).toBe("username");
  });

  it("accepts instagram handles with periods but rejects doubled/edge periods", () => {
    expect(ok("instagram", "a.b_c1").identifier).toBe("a.b_c1");
    expect(reason("instagram", ".abc")).toBe("bad-username");
    expect(reason("instagram", "abc.")).toBe("bad-username");
    expect(reason("instagram", "a..b")).toBe("bad-username");
  });

  it("rejects empty and over-long input", () => {
    expect(reason("instagram", "   ")).toBe("empty");
    expect(reason("instagram", "a".repeat(31))).toBe("bad-username");
    expect(reason("facebook", "a".repeat(201))).toBe("too-long");
  });

  it("rejects reserved instagram paths", () => {
    expect(reason("instagram", "reels")).toBe("bad-username");
    expect(reason("instagram", "explore")).toBe("bad-username");
  });

  it("requires a letter for facebook vanity names and at least 5 characters", () => {
    expect(ok("facebook", "anoneye.demo").identifier).toBe("anoneye.demo");
    expect(reason("facebook", "123456")).toBe("bad-username");
    expect(reason("facebook", "abcd")).toBe("bad-username");
  });
});

describe("parseProfileInput / URLs", () => {
  it("extracts the handle from instagram profile URLs", () => {
    expect(ok("instagram", "https://www.instagram.com/NASA/").identifier).toBe("nasa");
    expect(ok("instagram", "instagram.com/nasa").inputKind).toBe("url");
    expect(ok("instagram", "http://instagram.com/nasa").identifier).toBe("nasa");
    expect(ok("instagram", "https://instagram.com/nasa/reels/").inputKind).toBe("url");
  });

  it("extracts the handle from facebook profile URLs", () => {
    expect(ok("facebook", "https://www.facebook.com/anoneye.demo").identifier).toBe("anoneye.demo");
    expect(ok("facebook", "https://m.facebook.com/anoneye.demo/about").identifier).toBe("anoneye.demo");
  });

  it("rejects non-profile instagram paths", () => {
    expect(reason("instagram", "https://www.instagram.com/p/Cabc123/")).toBe("not-a-profile-path");
    expect(reason("instagram", "https://www.instagram.com/explore/tags/nasa/")).toBe("not-a-profile-path");
    expect(reason("instagram", "https://www.instagram.com/nasa/unknown-tab")).toBe("not-a-profile-path");
  });

  it("rejects foreign hosts (no SSRF-ish URL acceptance)", () => {
    expect(reason("instagram", "https://example.com/nasa")).toBe("wrong-host");
    expect(reason("instagram", "https://www.instagram.com.evil.example/nasa")).toBe("wrong-host");
    expect(reason("instagram", "javascript:alert(1)")).toBe("bad-url");
  });

  it("rejects credentials or ports embedded in the URL", () => {
    expect(reason("instagram", "https://user:pass@instagram.com/nasa")).toBe("bad-url");
    expect(reason("instagram", "https://instagram.com:8443/nasa")).toBe("bad-url");
  });

  it("rejects a URL from the other platform with an explicit platform mismatch", () => {
    expect(reason("instagram", "https://www.facebook.com/anoneye.demo")).toBe("platform-mismatch");
    expect(reason("facebook", "https://www.instagram.com/nasa/")).toBe("platform-mismatch");
  });
});

describe("canonical URLs and detection", () => {
  it("builds canonical URLs per platform", () => {
    expect(canonicalProfileUrl("instagram", "nasa")).toBe("https://www.instagram.com/nasa/");
    expect(canonicalProfileUrl("facebook", "anoneye.demo")).toBe("https://www.facebook.com/anoneye.demo");
  });

  it("detects the platform from a pasted URL only", () => {
    expect(detectPlatform("https://www.instagram.com/nasa")).toBe("instagram");
    expect(detectPlatform("https://fb.com/anoneye.demo")).toBe("facebook");
    expect(detectPlatform("nasa")).toBeNull();
    expect(detectPlatform("https://example.com/nasa")).toBeNull();
  });

  it("keeps validateUsername consistent with the full parser", () => {
    expect(validateUsername("instagram", "@nasa").ok).toBe(true);
    expect(validateUsername("instagram", "").ok).toBe(false);
  });
});
