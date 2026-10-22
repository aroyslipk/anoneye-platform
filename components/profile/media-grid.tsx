"use client";

import { ExternalLink, Play, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { useDateFormat, useI18n, useNumberFormat } from "@/lib/i18n/context";
import type { MediaItem } from "@/lib/providers/types";

export function MediaGrid({ items, full = false }: { items: MediaItem[]; full?: boolean }) {
  const { t } = useI18n();
  const number = useNumberFormat();
  const date = useDateFormat({ dateStyle: "medium" });

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-2 bg-paper/60 px-4 py-8 text-center text-sm text-ink-3">
        {t.profile.emptyMedia}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.id} className="group overflow-hidden rounded-xl border border-line bg-paper">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-paper-3">
            <SafeImage
              src={item.thumbnailUrl}
              alt={item.caption ?? t.profile.mediaTitle}
              fallbackLabel={t.profile.mediaExpired}
              className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
              sizes={full ? "(max-width: 640px) 50vw, 25vw" : "(max-width: 640px) 50vw, 20vw"}
            />
            <div className="absolute left-2 top-2 flex gap-1.5">
              {item.type === "video" ? (
                <span className="rounded-full bg-ink/70 p-1 text-white"><Play className="h-3 w-3" aria-hidden="true" /></span>
              ) : null}
              {item.type === "carousel" ? (
                <span className="rounded-full bg-ink/70 p-1 text-white"><Images className="h-3 w-3" aria-hidden="true" /></span>
              ) : null}
              {item.retrievalStatus !== "listed" ? <Badge tone="warn">{t.profile.mediaExpired}</Badge> : null}
            </div>
          </div>
          <div className="space-y-1 p-2.5">
            {item.caption ? <p className="line-clamp-2 text-[0.6875rem] leading-snug text-ink-2">{item.caption}</p> : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.625rem] text-ink-3">
              {item.timestamp ? <span>{date.format(new Date(item.timestamp))}</span> : null}
              {typeof item.likeCount === "number" ? <span>{number.format(item.likeCount)} ♥</span> : null}
              {typeof item.commentsCount === "number" ? <span>{number.format(item.commentsCount)} 💬</span> : null}
            </div>
            {item.permalink ? (
              <a
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-accent hover:underline"
              >
                {t.profile.openPost}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
