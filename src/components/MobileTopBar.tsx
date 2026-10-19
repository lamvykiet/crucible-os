"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Languages, Moon, Settings, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useSheetUnderNav } from "@/components/Scene";

/**
 * Thanh trên cùng cho màn hình nhỏ: tấm kính dính đỉnh trên phông cảnh —
 * logo + TÊN TRANG (grotesk viết hoa) + các nút.
 *
 * Dock dưới (`MobileNav`) chỉ chứa năm mục, nên ba lối vào sau nằm ở đây và
 * là đường DUY NHẤT tới chúng trên điện thoại — đừng gỡ:
 *   - Knowledge (từ 19/10/2026 nhường chỗ ở dock cho Sức khoẻ),
 *   - Cài đặt (/settings),
 *   - đổi ngôn ngữ và sáng/tối.
 */
export default function MobileTopBar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const scrolled = useSheetUnderNav();

  const titles: [string, string][] = [
    ["/finance", t("Finance", "Tài chính")],
    ["/learning", t("Learning", "Học tập")],
    ["/habits", t("Habits", "Thói quen")],
    ["/health", t("Health", "Sức khoẻ")],
    ["/knowledge", "Knowledge"],
    ["/settings", t("Settings", "Cài đặt")],
  ];
  const title = titles.find(([href]) => pathname.startsWith(href))?.[1] ?? t("Home", "Tổng quan");

  return (
    <header className="c-mtopbar md:hidden" data-scrolled={scrolled}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="c-logo-mark w-9 h-9">C</span>
        <span className="c-logo-word truncate">{title}</span>
      </div>

      <div className="flex items-center flex-none">
        <Link href="/knowledge" aria-label="Knowledge" className="c-mtopbar-btn">
          <Database size={20} strokeWidth={1.8} />
        </Link>
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
    </header>
  );
}
