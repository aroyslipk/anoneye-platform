import { cn } from "@/lib/utils/cn";

/**
 * Original Anoneye mark: a square aperture with an off-centre eye.
 * Drawn from primitives; not derived from another company's logo.
 */
export function LogoMark({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn("brand-mark shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="38" height="38" rx="12" fill="var(--accent)" />
      <path
        d="M8.5 21.5c3.4-5.9 8.2-8.8 13.9-8.8 5.2 0 9.2 3 12.1 8.8-2.9 5.3-6.9 8-12.1 8-5.7 0-10.5-2.8-13.9-8Z"
        fill="var(--accent-ink)"
        opacity="0.96"
      />
      <circle cx="22.6" cy="21.4" r="4.6" fill="var(--accent)" />
      <circle cx="24" cy="19.9" r="1.4" fill="var(--accent-ink)" />
      <path d="M10.5 12.3 13 8.7" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={compact ? 28 : 34} />
      <span className="text-[1.32rem] font-semibold tracking-[-0.03em] leading-none">
        Anon<span className="text-accent">eye</span>
      </span>
    </span>
  );
}
