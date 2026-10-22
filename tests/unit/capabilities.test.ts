import { describe, expect, it } from "vitest";
import { CAPABILITIES, explainCapability, getCapability } from "@/lib/providers/capabilities";
import { demoFacebookProvider, demoProvider } from "@/lib/providers/demo";
import { safeNextPath } from "@/lib/security/request";

describe("capability registry", () => {
  it("declares the same seven capabilities for both platforms", () => {
    for (const platform of ["instagram", "facebook"] as const) {
      expect(CAPABILITIES[platform].map((entry) => entry.id).sort()).toEqual(
        [
          "media-download",
          "metrics-history",
          "parse-input",
          "profile-lookup",
          "public-media",
          "stories",
          "visitor-identity",
        ].sort(),
      );
    }
  });

  it("never marks downloads, stories or visitor identity as available", () => {
    for (const platform of ["instagram", "facebook"] as const) {
      expect(getCapability(platform, "media-download").status).toBe("unsupported");
      expect(getCapability(platform, "stories").status).toBe("unsupported");
      expect(getCapability(platform, "visitor-identity").status).toBe("unsupported");
      expect(getCapability(platform, "parse-input").status).toBe("available");
      expect(getCapability(platform, "profile-lookup").status).toBe("requires-config");
    }
  });

  it("explains the unsupported capabilities honestly", () => {
    expect(explainCapability("visitor-identity")).toMatch(/does not expose/i);
    expect(explainCapability("media-download")).toMatch(/no authorised endpoint/i);
    expect(explainCapability("stories")).toMatch(/does not bypass/i);
  });

  it("points each capability at an official source", () => {
    for (const platform of ["instagram", "facebook"] as const) {
      for (const capability of CAPABILITIES[platform]) {
        expect(capability.sourceUrl).toMatch(/^https:\/\/developers\.facebook\.com\//);
      }
    }
  });
});

describe("demo provider isolation", () => {
  it("answers only for the reserved demo identifier", async () => {
    const demo = await demoProvider.lookupProfile(
      { platform: "instagram", identifier: "anoneye.demo", canonicalUrl: "", inputKind: "username" },
      {},
    );
    expect(demo.kind).toBe("ok");

    const real = await demoProvider.lookupProfile(
      { platform: "instagram", identifier: "nasa", canonicalUrl: "", inputKind: "username" },
      {},
    );
    expect(real).toEqual({ kind: "not-found", source: "demo fixture" });
  });

  it("marks every demo profile as synthetic", async () => {
    const result = await demoFacebookProvider.lookupProfile(
      { platform: "facebook", identifier: "anoneye.demo", canonicalUrl: "", inputKind: "username" },
      {},
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.demo).toBe(true);
    expect(result.data.source).toMatch(/synthetic/i);
    expect(result.data.limitations).toContain("demo-fixture");
  });
});

describe("safeNextPath", () => {
  it("allows the dashboard allowlist and public profile paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/tracked?x=1")).toBe("/dashboard/tracked?x=1");
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("/profile/instagram/nasa")).toBe("/profile/instagram/nasa");
  });

  it("blocks open redirects and control characters", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/admin")).toBe("/dashboard");
    expect(safeNextPath("/dashboard\nSet-Cookie: x=1")).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });
});
