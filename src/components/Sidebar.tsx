"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FileText, Database, GraduationCap, LayoutDashboard, Languages, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { name: t("Home", "Trang chủ"), href: "/", icon: LayoutDashboard },
    { name: t("Knowledge Hub", "Knowledge Hub"), href: "/knowledge", icon: Database },
    { name: t("Finance OS", "Sổ chi tiêu"), href: "/finance", icon: FileText },
    { name: t("Learning Hub", "Learning Hub"), href: "/learning", icon: GraduationCap },
  ];

  return (
    /* Ẩn dưới md: điện thoại dùng MobileNav. `.c-sidebar` là lớp của design
       system, rộng đúng 248px — bản cũ tự đặt w-64 (256px). */
    <div className="c-sidebar hidden md:flex">
      <div className="h-16 flex items-center px-6 gap-3 mt-4">
        {/* bg-primary và text-[--color-on-primary] đều không phải class hợp lệ
            (thiếu var(), thiếu định nghĩa) — dùng token cho cả nền lẫn chữ. */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)]">
          C
        </div>
        <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Crucible</span>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                isActive 
                  ? "bg-[var(--color-surface-2)] text-[var(--color-primary)] shadow-sm" 
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)] space-y-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] rounded-lg transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{t("Theme", "Giao diện")}</span>
          </div>
          <span className="font-bold text-xs uppercase bg-[var(--color-surface-3)] px-2 py-0.5 rounded">
            {theme === "dark" ? t("Dark", "Tối") : t("Light", "Sáng")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] rounded-lg transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Languages size={18} />
            <span>{t("Language", "Ngôn ngữ")}</span>
          </div>
          <span className="font-bold text-xs uppercase bg-[var(--color-surface-3)] px-2 py-0.5 rounded">{language}</span>
        </button>
        <Link href="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${
          pathname === '/settings' ? "bg-[var(--color-surface-2)] text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        }`}>
          <Settings size={18} />
          <span>{t("Settings", "Cài đặt")}</span>
        </Link>
      </div>
    </div>
  );
}
