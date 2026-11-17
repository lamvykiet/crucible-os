"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Languages, Moon, Settings, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { MODULES, moduleFor } from "@/lib/modules";
import { useQuickActions } from "@/components/QuickActions";
import Logo from "@/components/Logo";

/**
 * Thanh trên cho điện thoại (demo `.mtop`): kính, dính đỉnh.
 *
 *   [logo ▾] TÊN FUNCTION                  [chuông · sáng/tối · cài đặt]
 *
 * Chạm logo là xổ danh sách MỌI function (kèm đổi ngôn ngữ) — lối đổi function
 * trên điện thoại. Tab con không còn ở đây: chúng nằm ở dải `ModuleTabs` đầu nội
 * dung. Dock thao tác nhanh nằm ở đáy (`QuickDock`).
 *
 * Cài đặt nằm ở đây và là đường DUY NHẤT tới /settings trên điện thoại — đừng gỡ.
 * Chuông mở hàng đợi duyệt hoá đơn khi có việc, không thì đi tới Cài đặt.
 */
export default function MobileTopBar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { pending, open: openOverlay } = useQuickActions();
  const [open, setOpen] = useState(false);

  const mod = moduleFor(pathname);
  const title = mod ? t(mod.en, mod.vi) : pathname.startsWith("/settings") ? t("Settings", "Cài đặt") : "Crucible";

  return (
    <header className="c-mtopbar md:hidden">
      <div className="relative flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t("Choose a function", "Chọn function")}
          className="c-fnmenu-trigger"
        >
          <Logo size={14} />
          <ChevronDown size={14} strokeWidth={2} className={`opacity-80 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <span className="c-mtopbar-title truncate">{title}</span>

        {open && (
          <>
            {/* Lớp chạm ra ngoài để đóng menu. */}
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-50 cursor-default" onClick={() => setOpen(false)} />
            <nav className="c-fnmenu-panel" aria-label={t("Functions", "Function")}>
              {MODULES.map(({ key, href, icon: Icon, en, vi }) => (
                <Link key={key} href={href} onClick={() => setOpen(false)} className={`c-fnmenu-item ${mod?.key === key ? "active" : ""}`}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{t(en, vi)}</span>
                </Link>
              ))}
              <button
                type="button"
                className="c-fnmenu-item"
                onClick={() => {
                  setLanguage(language === "en" ? "vi" : "en");
                  setOpen(false);
                }}
              >
                <Languages size={18} strokeWidth={1.8} />
                <span>{t("Language", "Ngôn ngữ")}: {language.toUpperCase()}</span>
              </button>
            </nav>
          </>
        )}
      </div>

      <div className="flex items-center flex-none">
        {pending > 0 ? (
          <button type="button" onClick={() => openOverlay("review")} aria-label={t(`${pending} receipts to review`, `${pending} hoá đơn chờ duyệt`)} className="c-mtopbar-btn">
            <Bell size={20} strokeWidth={1.8} />
            <span className="c-dot" aria-hidden />
          </button>
        ) : (
          <Link href="/settings" aria-label={t("Notifications", "Thông báo")} className="c-mtopbar-btn">
            <Bell size={20} strokeWidth={1.8} />
          </Link>
        )}
        <button type="button" onClick={toggleTheme} aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")} className="c-mtopbar-btn">
          {theme === "dark" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
        </button>
        <Link href="/settings" aria-label={t("Settings", "Cài đặt")} className="c-mtopbar-btn">
          <Settings size={20} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
