import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isPlatform } from "@/lib/providers/types";
import { parseProfileInput } from "@/lib/providers/parse";
import { getRepository, getSessionUser } from "@/lib/auth/session";
import { lookupParsedProfile } from "@/lib/services/lookup";
import { ProfileState } from "@/components/profile/profile-state";
import { MediaPageView } from "@/components/profile/media-page-view";
import type { Repository } from "@/lib/db/types";

export const instant = false;

interface RouteParams {
  params: Promise<{ platform: string; identifier: string }>;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { identifier } = await params;
  return {
    title: `Media · @${safeDecode(identifier).replace(/^@/, "")}`,
    robots: { index: false, follow: false },
  };
}

export default async function ProfileMediaPage({ params }: RouteParams) {
  // Provider fixtures read the current time; make the render runtime-only first.
  await connection();
  const { platform: rawPlatform, identifier: rawIdentifier } = await params;
  if (!isPlatform(rawPlatform)) notFound();
  const parsedResult = parseProfileInput(rawPlatform, safeDecode(rawIdentifier));
  if (!parsedResult.ok) notFound();
  const parsed = parsedResult.value;

  const user = await getSessionUser().catch(() => null);
  let repo: Repository | null = null;
  if (user) {
    try {
      repo = getRepository();
    } catch {
      repo = null;
    }
  }
  const outcome = await lookupParsedProfile({ platform: parsed.platform, parsed, user, repo });

  if (!outcome.result || outcome.result.kind !== "ok") {
    const failure = outcome.result;
    return (
      <ProfileState
        kind={failure && failure.kind !== "invalid-input" ? failure.kind : "unavailable"}
        platform={parsed.platform}
        identifier={parsed.identifier}
        canonicalUrl={parsed.canonicalUrl}
        missing={failure?.kind === "not-configured" ? failure.missing : undefined}
      />
    );
  }

  return <MediaPageView profile={outcome.result.data} />;
}
