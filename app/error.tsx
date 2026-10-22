"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    // Keep the digest only; error messages can contain server details.
    console.error("route_error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">{t.errors.genericTitle}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">{t.errors.genericBody}</p>
      {error.digest ? <p className="mt-2 font-mono text-[0.625rem] text-ink-3">{t.errors.errorId}: {error.digest}</p> : null}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={reset} className={buttonClass({ size: "sm" })}>{t.errors.retry}</button>
        <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>{t.errors.notFoundHome}</Link>
      </div>
    </div>
  );
}
