import { connection, type NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { lookupQuerySchema } from "@/lib/api/validation";
import { ValidationError } from "@/lib/errors";
import { getSessionUser, getRepository } from "@/lib/auth/session";
import { lookupPublicProfile } from "@/lib/services/lookup";
import type { Repository } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  // Ensure Next never attempts to prerender a handler that reads request headers.
  await connection();
  try {
    enforceRateLimit(request, "profile-lookup", 30, 60);
    const parsedQuery = lookupQuerySchema.safeParse({
      platform: request.nextUrl.searchParams.get("platform"),
      input: request.nextUrl.searchParams.get("input"),
    });
    if (!parsedQuery.success) {
      throw new ValidationError("platform and input are required");
    }

    const user = await getSessionUser().catch(() => null);
    let repo: Repository | null = null;
    if (user) {
      try {
        repo = getRepository();
      } catch {
        repo = null;
      }
    }

    const outcome = await lookupPublicProfile({
      platform: parsedQuery.data.platform,
      rawInput: parsedQuery.data.input,
      user,
      repo,
      signal: request.signal,
    });

    if (!outcome.parsed) {
      throw new ValidationError("The profile link is not valid", {
        reason: outcome.invalidReason ?? "bad-url",
      });
    }

    return apiJson({
      ok: true,
      parsed: outcome.parsed,
      result: outcome.result,
      demo: outcome.demo,
    });
  } catch (error) {
    return apiError(error);
  }
}
