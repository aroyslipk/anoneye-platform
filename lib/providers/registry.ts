import { instagramProvider } from "./instagram";
import { facebookProvider } from "./facebook";
import { isDemoMode } from "@/lib/env";
import { isDemoIdentifier } from "./demo";
import type { Platform, SocialProvider } from "./types";

export {
  CAPABILITIES,
  REQUIRED_ENV_FOR_LOOKUP,
  REQUIRED_ENV_SERVER_TOKEN,
  explainCapability,
  getCapability,
} from "./capabilities";

export const PROVIDERS: Record<Platform, SocialProvider> = {
  instagram: instagramProvider,
  facebook: facebookProvider,
};

export function getProvider(platform: Platform): SocialProvider {
  return PROVIDERS[platform];
}

/**
 * Demo fixtures are opt-in (ANONEYE_DEMO_MODE) and only answer for the
 * reserved `anoneye.demo` identifier. Real identifiers always go to the real
 * provider, so demo mode can never mask a live integration.
 */
export function useDemoProvider(platform: Platform, identifier: string): boolean {
  return isDemoMode() && isDemoIdentifier(platform, identifier);
}

export function providerLabel(platform: Platform): string {
  return platform === "instagram" ? "Instagram" : "Facebook";
}
