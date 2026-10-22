"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Plain <img> on purpose: Anoneye never proxies provider media through its own
 * server. The browser loads the CDN URL directly, and only https or local
 * asset paths are accepted.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallbackLabel,
  sizes,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  sizes?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === src;

  const allowed = typeof src === "string" && (src.startsWith("/") || src.startsWith("https://"));

  if (!allowed || failed) {
    return (
      <span
        className={cn("flex flex-col items-center justify-center gap-1.5 bg-paper-3 text-ink-3", className)}
        role="img"
        aria-label={fallbackLabel ?? alt}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
        {fallbackLabel ? <span className="px-2 text-center text-[0.625rem] leading-tight">{fallbackLabel}</span> : null}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn("object-cover", className)}
    />
  );
}
