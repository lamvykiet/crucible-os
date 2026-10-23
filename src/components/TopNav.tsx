"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Languages, Moon, Settings, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useSheetUnderNav } from "@/components/Scene";
import { MODULES, moduleFor } from "@/lib/modules";
import ModuleTabs from "@/components/ModuleTabs";

/**
 * Thanh điều hướng trên cùng (từ 768px trở lên): tấm kính nổi trên phông cảnh.
 *
 *   [logo ▾]  [tab con của function đang mở …]            [ngôn ngữ · cài đặt · sáng/tối]
 *
 * Các function gom vào logo: rê chuột (hoặc Tab tới) logo là xổ danh sách
 * icon + tên. Chỗ trống giữa thanh dành cho TAB CON của function đang mở —
 * đổi theo function, lấy từ `src/lib/modules.tsx`. Trang Tổng quan và Cài
 * đặt không có tab con.
 *
 * Không có sidebar. Điện thoại dùng `MobileTopBar` + dock `MobileNav` — thanh
 * này ẩn dưới 768px.
 *
 * Thanh KHÔNG có `overflow` (menu xổ sẽ bị cắt); dải tab mới cuộn ngang.
 */
export default function TopNav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const scrolled = useSheetUnderNav();
  const current = moduleFor(pathname);

  return (
    <header className="c-topnav hidden md:flex" data-scrolled={scrolled}>
      <div className="c-fnmenu">
        <button
          type="button"
          className="c-fnmenu-trigger"
          aria-haspopup="menu"
          aria-label={t("Choose a function", "Chọn function")}
        >
          <span className="c-logo-mark w-9 h-9">C</span>
          <ChevronDown size={14} strokeWidth={2} className="opacity-80" />
        </button>
        <nav className="c-fnmenu-panel" aria-label={t("Functions", "Function")}>
          {MODULES.map(({ key, href, icon: Icon, en, vi }) => (
            <Link
              key={key}
              href={href}
              onClick={(e) => e.currentTarget.blur()}
              className={`c-fnmenu-item ${current?.key === key ? "active" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{t(en, vi)}</span>
            </Link>
          ))}
        </nav>
      </div>

      <Suspense fallback={<div className="flex-1" />}>
        <ModuleTabs variant="bar" />
      </Suspense>

      <div className="flex items-center gap-0.5 flex-none pl-4">
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="c-topnav-item"
        >
          <Languages size={16} strokeWidth={1.8} />
          <span className="text-xs uppercase">{language}</span>
        </button>

        <Link
          href="/settings"
          aria-label={t("Settings", "Cài đặt")}
          className={`c-topnav-item ${pathname.startsWith("/settings") ? "active" : ""}`}
        >
          <Settings size={16} strokeWidth={1.8} />
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="c-topnav-item"
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
      </div>
    </header>
  );
}
