"use client";

import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "ok";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-accent-soft text-accent"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : tone === "ok"
          ? "bg-ok-soft text-ok"
          : "bg-paper-3 text-ink-3";
  return (
    <div className="rounded-card border border-line bg-paper-2 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-3">{label}</p>
        {icon ? <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[0.6875rem] text-ink-3">{hint}</p> : null}
    </div>
  );
}
