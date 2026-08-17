"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { getNavItems, isNavActive } from "@/components/nav-items";

/** Điều hướng đáy màn hình cho mobile — thay cho sidebar bị ẩn dưới 768px.
 *  CSS (.c-shell-bottomnav) lo việc cố định đáy và ẩn ở desktop. */
export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const navItems = getNavItems(t);

  return (
    <nav className="c-shell-bottomnav c-bottomnav" aria-label={t("Main", "Điều hướng chính")}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`c-bottomnav-item${active ? " active" : ""}`}
          >
            <Icon size={20} />
            <span>{item.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
