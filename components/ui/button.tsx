import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-card hover:bg-accent-2 active:translate-y-px disabled:hover:bg-accent",
  secondary:
    "bg-paper-2 text-ink border border-line-2 hover:border-accent/50 hover:bg-accent-soft/40 active:translate-y-px",
  outline:
    "bg-transparent text-ink border border-line-2 hover:bg-paper-3 active:translate-y-px",
  ghost: "bg-transparent text-ink-2 hover:bg-paper-3 hover:text-ink",
  soft: "bg-accent-soft text-accent hover:bg-accent-soft-2",
  danger: "bg-bad text-white hover:opacity-90 active:translate-y-px",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3.5 text-[0.8125rem] gap-1.5",
  md: "min-h-11 px-5 text-sm gap-2",
  lg: "min-h-12 px-6 text-[0.95rem] gap-2.5",
  icon: "h-11 w-11 p-0",
};

export function buttonClass(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center rounded-full font-medium tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-55",
    VARIANTS[options.variant ?? "primary"],
    SIZES[options.size ?? "md"],
    options.className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({ variant, size, className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}
