import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "bad" | "demo";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line text-ink-2 bg-paper-2",
  accent: "border-accent/25 text-accent bg-accent-soft",
  ok: "border-ok/25 text-ok bg-ok-soft",
  warn: "border-warn/30 text-warn bg-warn-soft",
  bad: "border-bad/25 text-bad bg-bad-soft",
  demo: "border-violet/30 text-violet bg-accent-soft",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium leading-5 tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
