"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";

/** Thanh trên cùng cho mobile.
 *
 *  Nút đổi theme và đổi ngôn ngữ trước đây chỉ nằm ở chân sidebar. Sidebar bị ẩn
 *  dưới 768px nên nếu không có thanh này thì trên điện thoại không còn cách nào
 *  chạm tới hai tuỳ chọn đó. CSS (.c-shell-topbar) lo việc ẩn ở desktop. */
export default function MobileTopBar() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="c-shell-topbar">
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)]">
        C
      </div>
      <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        Crucible
      </span>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="c-shell-topbar-btn"
        >
          {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="c-shell-topbar-btn"
        >
          <Languages size={20} />
          <span className="text-[11px] font-bold uppercase">{language}</span>
        </button>
      </div>
    </header>
  );
}
