"use client";

import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MediaGrid } from "@/components/profile/media-grid";
import { useI18n } from "@/lib/i18n/context";
import type { PublicProfile } from "@/lib/providers/types";

export function MediaPageView({ profile }: { profile: PublicProfile }) {
  const { t } = useI18n();
  const platformLabel = profile.platform === "instagram" ? t.platform.instagram : t.platform.facebook;

  return (
    <div className="shell py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/profile/${profile.platform}/${encodeURIComponent(profile.identifier)}`}
          className="text-xs font-medium text-ink-3 hover:text-ink"
        >
          ← {profile.displayName ?? `@${profile.username}`}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{platformLabel}</Badge>
          <Badge tone="neutral">@{profile.username}</Badge>
          {profile.demo ? <Badge tone="demo">{t.demo.badge}</Badge> : null}
        </div>
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{t.profile.mediaTitle}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">{t.profile.mediaNote}</p>

      {profile.mediaHasMore ? <div className="mt-4"><Alert tone="info">{t.profile.mediaLimited}</Alert></div> : null}

      <div className="mt-5">
        <MediaGrid items={profile.media} full />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.6875rem] leading-relaxed text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {t.profile.dataSource}: {profile.source}
        </span>
        <a
          href={profile.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          {t.profile.openOriginal.replace("{platform}", platformLabel)}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        <span>{t.profile.limitationsTitle}: {t.limitations["stories-not-supported"]}</span>
      </div>
    </div>
  );
}
