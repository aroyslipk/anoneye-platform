"use client";

import { useI18n, useNumberFormat } from "@/lib/i18n/context";
import type { MetricSet } from "@/lib/providers/types";

export function MetricGrid({ metrics, compact = false }: { metrics: MetricSet; compact?: boolean }) {
  const { t } = useI18n();
  const number = useNumberFormat();
  const entries = [
    { key: "followers" as const, label: t.profile.followers },
    { key: "following" as const, label: t.profile.following },
    { key: "mediaCount" as const, label: t.profile.mediaCount },
  ];

  return (
    <dl className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
      {entries.map((entry) => {
        const value = metrics[entry.key];
        return (
          <div key={entry.key} className="rounded-xl border border-line bg-paper-2 px-4 py-3">
            <dt className="text-[0.6875rem] uppercase tracking-wide text-ink-3">{entry.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {typeof value === "number" ? number.format(value) : <span className="text-ink-3" title={t.common.notAvailable}>—</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
