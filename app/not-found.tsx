"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-mono text-xs tracking-[0.2em] text-ink-3">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">{t.errors.notFoundBody}</p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className={buttonClass({ size: "sm" })}>{t.errors.notFoundHome}</Link>
        <Link href="/search" className={buttonClass({ variant: "secondary", size: "sm" })}>{t.nav.search}</Link>
      </div>
    </div>
  );
}
