import "server-only";
import { isDemoMode } from "@/lib/env";
import { logger, describeError } from "@/lib/logger";
import { decryptToken } from "@/lib/crypto/tokens";
import { getProvider } from "@/lib/providers/registry";
import { demoProvider, demoFacebookProvider, isDemoIdentifier } from "@/lib/providers/demo";
import { parseProfileInput } from "@/lib/providers/parse";
import type {
  ParsedProfileInput,
  Platform,
  ProviderResult,
  ProviderRuntimeContext,
  PublicProfile,
} from "@/lib/providers/types";
import type { AuthUser } from "@/lib/auth/session";
import type { ConnectedAccount, Repository } from "@/lib/db/types";

export interface LookupOutcome {
  parsed: ParsedProfileInput | null;
  invalidReason?: string;
  result: ProviderResult<PublicProfile> | null;
  demo: boolean;
}

/**
 * Resolve server-side credentials for a provider without ever returning them.
 * A missing/expired connected account yields an empty context, which makes the
 * provider report `not-configured` instead of pretending a lookup happened.
 */
export async function resolveProviderContext(
  user: AuthUser | null,
  platform: Platform,
  repo: Repository | null,
  signal?: AbortSignal,
): Promise<ProviderRuntimeContext> {
  const context: ProviderRuntimeContext = { signal };
  if (!user || !repo) return context;

  let account: ConnectedAccount | null = null;
  try {
    account = await repo.findConnectedAccount(user.id, platform);
  } catch (error) {
    logger.warn("connected_account_lookup_failed", { error: describeError(error) });
    return context;
  }
  if (!account) return context;

  if (account.tokenExpiresAt && Date.parse(account.tokenExpiresAt) <= Date.now()) {
    await repo.markConnectedAccountStatus(user.id, account.id, "expired").catch(() => undefined);
    return context;
  }

  const ciphertext = await repo.getConnectedAccountToken(user.id, account.id).catch(() => null);
  if (!ciphertext) return context;

  try {
    const token = decryptToken(ciphertext);
    context.accessToken = token;
    if (platform === "instagram") {
      context.instagramBusinessId = account.providerAccountId;
    } else {
      context.pageAccessToken = token;
      context.pageId = account.providerAccountId;
    }
  } catch (error) {
    logger.error("connected_account_decrypt_failed", {
      accountId: account.id,
      error: describeError(error),
    });
  }
  return context;
}

/** Look up one public profile. Provider failures are typed results, never thrown. */
export async function lookupPublicProfile(options: {
  platform: Platform;
  rawInput: string;
  user: AuthUser | null;
  repo: Repository | null;
  signal?: AbortSignal;
}): Promise<LookupOutcome> {
  const parsed = parseProfileInput(options.platform, options.rawInput);
  if (!parsed.ok) {
    return { parsed: null, invalidReason: parsed.reason, result: null, demo: false };
  }
  return lookupParsedProfile({ ...options, parsed: parsed.value });
}

export async function lookupParsedProfile(options: {
  platform: Platform;
  parsed: ParsedProfileInput;
  user: AuthUser | null;
  repo: Repository | null;
  signal?: AbortSignal;
}): Promise<LookupOutcome> {
  const demo = isDemoMode() && isDemoIdentifier(options.platform, options.parsed.identifier);
  const provider = demo
    ? options.platform === "instagram"
      ? demoProvider
      : demoFacebookProvider
    : getProvider(options.platform);

  const context = demo
    ? { demo: true, signal: options.signal }
    : await resolveProviderContext(options.user, options.platform, options.repo, options.signal);

  if (!demo && !provider.isConfigured(context)) {
    return {
      parsed: options.parsed,
      result: { kind: "not-configured", missing: provider.missingConfig() },
      demo: false,
    };
  }

  try {
    const result = await provider.lookupProfile(options.parsed, context);
    return { parsed: options.parsed, result, demo };
  } catch (error) {
    logger.error("provider_lookup_unhandled", {
      platform: options.platform,
      identifier: options.parsed.identifier,
      error: describeError(error),
    });
    return {
      parsed: options.parsed,
      result: {
        kind: "unavailable",
        source: options.platform === "instagram" ? "Instagram Graph API" : "Facebook Graph API",
      },
      demo,
    };
  }
}
