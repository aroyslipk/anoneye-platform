"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";
import { buttonClass } from "@/components/ui/button";

export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className={buttonClass({ variant: "ghost", size: "icon", className: "rounded-full" })}
      aria-label={t.nav.theme}
      title={isDark ? t.nav.themeLight : t.nav.themeDark}
    >
      {isDark ? <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" /> : <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
    </button>
  );
}
