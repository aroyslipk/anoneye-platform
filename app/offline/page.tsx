"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <WifiOff className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">{t.pwa.offlineTitle}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">{t.pwa.offlineBody}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className={buttonClass({ size: "sm" })}>
          {t.pwa.retry}
        </button>
        <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>{t.common.back}</Link>
      </div>
    </div>
  );
}
