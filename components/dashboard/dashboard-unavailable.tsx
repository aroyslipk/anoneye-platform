"use client";

import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/context";

export function DashboardUnavailable({ detail }: { detail?: string }) {
  const { t } = useI18n();
  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{t.dashboard.title}</h1>
        <div className="mt-4">
          <Alert tone="bad" title={t.dashboard.backendUnconfigured}>{t.dashboard.backendUnconfiguredBody}</Alert>
        </div>
        {detail ? (
          <p className="mt-3 rounded-lg bg-paper-3/70 px-3 py-2 font-mono text-[0.6875rem] text-ink-3">{detail}</p>
        ) : null}
        <div className="mt-5">
          <EmptyState
            icon={<DatabaseZap aria-hidden="true" />}
            title={t.settings.backend}
            body={t.dashboard.backendUnconfiguredBody}
            action={<Link href="/settings" className={buttonClass({ size: "sm" })}>{t.dashboard.setupCta}</Link>}
          />
        </div>
      </div>
    </div>
  );
}
