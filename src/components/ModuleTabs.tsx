"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { isTabActive, moduleFor } from "@/lib/modules";

/**
 * Dải tab con của function đang mở, lấy từ `src/lib/modules.tsx`.
 *
 * Dùng ở HAI nơi với cùng một danh sách, để web và điện thoại không lệch nhau:
 *   - `bar`  — giữa thanh kính `TopNav` (từ 768px): icon + chữ.
 *   - `rail` — hàng dưới của `MobileTopBar` (điện thoại): chỉ icon, tab đang
 *              chọn hiện thêm chữ (SKILL.md mục 5).
 *
 * Đọc `useSearchParams()` nên nơi dùng phải bọc `<Suspense>`.
 */
export default function ModuleTabs({ variant }: { variant: "bar" | "rail" }) {
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const { t } = useLanguage();
  const current = moduleFor(pathname);
  const tabs = current?.tabs ?? [];

  if (variant === "rail" && tabs.length === 0) return null;

  return (
    <nav
      className={variant === "bar" ? "c-topnav-tabs" : "c-mtabs"}
      aria-label={current ? t(current.en, current.vi) : undefined}
    >
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        const active = isTabActive(tab, pathname, tabParam, i === 0);
        const label = t(tab.en, tab.vi);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={`${variant === "bar" ? "c-topnav-item" : "c-mtab"} ${active ? "active" : ""}`}
          >
            <Icon size={variant === "bar" ? 16 : 20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
