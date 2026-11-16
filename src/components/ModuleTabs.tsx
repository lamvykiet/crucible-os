"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { isTabActive, moduleFor } from "@/lib/modules";

/**
 * Dải tab con của function đang mở, lấy từ `src/lib/modules.tsx`.
 *
 * Dùng ở HAI nơi với cùng một danh sách, để web và điện thoại không lệch nhau:
 *   - `side` — nhóm tab trong `Sidebar` (từ 768px): icon + chữ, chữ ẩn khi
 *              sidebar thu gọn.
 *   - `rail` — hàng dưới của `MobileTopBar` (điện thoại): rãnh lõm, tab
 *              thường chỉ icon 42×42, tab đang chọn NỞ thành viên icon + chữ
 *              nền màu ô của mảng (skill suong-som-design 7.3). Không có
 *              dock đáy.
 *
 * Đọc `useSearchParams()` nên nơi dùng phải bọc `<Suspense>`.
 */
export default function ModuleTabs({ variant }: { variant: "side" | "rail" }) {
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const { t } = useLanguage();
  const current = moduleFor(pathname);
  const tabs = current?.tabs ?? [];
  const navRef = useRef<HTMLElement>(null);

  // Hàng tab trên điện thoại cuộn ngang: tab đang chọn (vd. Lịch sử, tab thứ
  // tám của Tài chính) có thể nằm ngoài khung — đưa nó vào giữa. Chỉnh
  // `scrollLeft` thay vì scrollIntoView để không kéo cả trang theo chiều dọc.
  useEffect(() => {
    if (variant !== "rail") return;
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav || !active) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname, tabParam, variant]);

  if (variant === "rail" && tabs.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className={variant === "side" ? "c-side-tabs" : "c-mtabs"}
      // `data-mod`: tab đang chọn nở thành viên mang màu ô của mảng (skill 7.3)
      // — màu đặt trong globals.css theo khoá function, không viết hex ở đây.
      data-mod={current?.key}
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
            title={label}
            className={`${variant === "side" ? "c-side-item" : "c-mtab"} ${active ? "active" : ""}`}
          >
            <Icon size={variant === "rail" ? 20 : 18} strokeWidth={1.8} aria-hidden />
            <span className={variant === "side" ? "c-side-text" : undefined}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
