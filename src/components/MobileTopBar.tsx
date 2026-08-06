"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Thanh trên cùng cho màn hình nhỏ.
 *
 * Nút đổi giao diện sáng/tối và đổi ngôn ngữ nằm ở chân sidebar, mà sidebar thì
 * ẩn trên điện thoại — không có thanh này thì hai chức năng đó không còn đường
 * nào chạm tới. Thanh dưới đã kín 5 mục điều hướng theo đúng design system nên
 * không nhét thêm được.
 */
export default function MobileTopBar() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)]">
          C
        </div>
        <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Crucible
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
        >
          {theme === "dark" ? <Moon size={20} strokeWidth={2} /> : <Sun size={20} strokeWidth={2} />}
        </button>

        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="h-11 min-w-11 px-2 flex items-center justify-center gap-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
        >
          <Languages size={20} strokeWidth={2} />
          <span className="font-bold text-xs uppercase">{language}</span>
        </button>
      </div>
    </header>
  );
}
