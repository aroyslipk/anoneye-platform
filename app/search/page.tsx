import type { Metadata } from "next";
import { connection } from "next/server";
import { getSessionUser, getRepository } from "@/lib/auth/session";
import { lookupParsedProfile } from "@/lib/services/lookup";
import { parseProfileInput, detectPlatform } from "@/lib/providers/parse";
import { isDemoMode } from "@/lib/env";
import { isPlatform, type Platform } from "@/lib/providers/types";
import { SearchView } from "@/components/search/search-view";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Repository } from "@/lib/db/types";

// Reads searchParams; render dynamically instead of prerendering an empty search.
export const instant = false;

export const metadata: Metadata = {
  title: dictionaries.bn.search.title,
  description: dictionaries.bn.search.subtitle,
  alternates: { canonical: "/search" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  // Provider fixtures read the current time; make the render runtime-only first.
  await connection();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = rawQuery.slice(0, 200).trim();
  const requestedPlatform = typeof params.platform === "string" ? params.platform : undefined;
  const platform: Platform = isPlatform(requestedPlatform)
    ? requestedPlatform
    : detectPlatform(query) ?? "instagram";

  const parsedResult = query ? parseProfileInput(platform, query) : null;
  const parsed = parsedResult?.ok ? parsedResult.value : null;
  const invalidReason = parsedResult && !parsedResult.ok ? parsedResult.reason : undefined;

  const user = await getSessionUser().catch(() => null);
  let repo: Repository | null = null;
  if (user) {
    try {
      repo = getRepository();
    } catch {
      repo = null;
    }
  }

  const outcome = parsed
    ? await lookupParsedProfile({ platform, parsed, user, repo })
    : { parsed: null, result: null, demo: false, invalidReason };

  let tracked = false;
  if (user && repo && parsed) {
    try {
      tracked = Boolean(await repo.findTracked(user.id, platform, parsed.identifier));
    } catch {
      tracked = false;
    }
  }

  return (
    <SearchView
      key={`${platform}:${query}`}
      platform={platform}
      query={query}
      parsed={outcome.parsed}
      invalidReason={outcome.parsed ? undefined : (invalidReason ?? outcome.invalidReason)}
      result={outcome.result}
      demo={outcome.demo}
      demoMode={isDemoMode()}
      signedIn={Boolean(user)}
      tracked={tracked}
    />
  );
}
