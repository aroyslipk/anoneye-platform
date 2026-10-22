"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";

export function DashboardNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/dashboard/tracked", label: t.nav.tracked },
    { href: "/dashboard/reports", label: t.nav.reports },
    { href: "/settings", label: t.nav.settings },
  ];
  return (
    <div className="border-b border-line bg-paper-2/50">
      <nav aria-label={t.footer.product} className="shell scroll-x flex gap-1 py-2">
        {links.map((link) => {
          const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors focus-ring",
                active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-paper-3 hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
