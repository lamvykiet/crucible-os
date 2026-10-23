"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Languages, Moon, Settings, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useSheetUnderNav } from "@/components/Scene";
import { MODULES, moduleFor } from "@/lib/modules";
import ModuleTabs from "@/components/ModuleTabs";

/**
 * Thanh trên cho điện thoại — cùng cấu trúc với `TopNav` của web:
 *
 *   hàng 1: [logo ▾] TÊN FUNCTION                [cài đặt · ngôn ngữ · sáng/tối]
 *   hàng 2: tab con của function đang mở (chỉ icon, tab chọn hiện chữ)
 *
 * Chạm logo là xổ danh sách MỌI function (cả Knowledge — thứ không có chỗ
 * trong dock năm mục). Điện thoại không có hover nên menu mở bằng state, không
 * bằng `:hover` như web.
 *
 * Cài đặt nằm ở đây và là đường DUY NHẤT tới /settings trên điện thoại — đừng gỡ.
 */
export default function MobileTopBar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const scrolled = useSheetUnderNav();
  const [open, setOpen] = useState(false);

  const mod = moduleFor(pathname);
  const title = mod ? t(mod.en, mod.vi) : pathname.startsWith("/settings") ? t("Settings", "Cài đặt") : "Crucible";
  const hasTabs = (mod?.tabs.length ?? 0) > 0;

  return (
    <header className={`c-mtopbar md:hidden ${hasTabs ? "has-tabs" : ""}`} data-scrolled={scrolled}>
      <div className="c-mtopbar-row">
        <div className="relative flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={t("Choose a function", "Chọn function")}
            className="c-fnmenu-trigger"
          >
            <span className="c-logo-mark w-9 h-9">C</span>
            <ChevronDown size={14} strokeWidth={2} className={`opacity-80 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <span className="c-logo-word truncate">{title}</span>

          {open && (
            <>
              {/* Lớp chạm ra ngoài để đóng menu. */}
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-50 cursor-default" onClick={() => setOpen(false)} />
              <nav className="c-fnmenu-panel open" aria-label={t("Functions", "Function")}>
                {MODULES.map(({ key, href, icon: Icon, en, vi }) => (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`c-fnmenu-item ${mod?.key === key ? "active" : ""}`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{t(en, vi)}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="flex items-center flex-none">
          <Link href="/settings" aria-label={t("Settings", "Cài đặt")} className="c-mtopbar-btn">
            <Settings size={20} strokeWidth={1.8} />
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "vi" : "en")}
            aria-label={t("Toggle language", "Đổi ngôn ngữ")}
            className="c-mtopbar-btn"
          >
            <Languages size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
            className="c-mtopbar-btn"
          >
            {theme === "dark" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      <Suspense>
        <ModuleTabs variant="rail" />
      </Suspense>
    </header>
  );
}
