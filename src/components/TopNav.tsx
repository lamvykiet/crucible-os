"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, Wallet, Database, GraduationCap, LayoutDashboard,
  Languages, Moon, Sun, Repeat, HeartPulse,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useSheetUnderNav } from "@/components/Scene";

/**
 * Thanh điều hướng trên cùng (từ 768px trở lên): tấm kính nổi trên phông cảnh
 * hoàng hôn, bo 22px — logo vuông trắng · các mục icon 16px + chữ · nút điều
 * khiển. Mục đang chọn là viên trắng 92% chữ nâu.
 *
 * Không có sidebar. Điện thoại dùng `MobileTopBar` + dock `MobileNav` — thanh
 * này ẩn dưới 768px.
 *
 * Thanh cuộn ngang được (`.c-topnav` đặt `overflow-x: auto`): ở 1024px mục
 * cuối sẽ bị cắt nếu không cho cuộn.
 */
export default function TopNav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const scrolled = useSheetUnderNav();

  const navItems = [
    { name: t("Home", "Tổng quan"), href: "/", icon: LayoutDashboard },
    { name: t("Finance", "Tài chính"), href: "/finance", icon: Wallet },
    { name: t("Learning", "Học tập"), href: "/learning", icon: GraduationCap },
    { name: t("Habits", "Thói quen"), href: "/habits", icon: Repeat },
    { name: t("Health", "Sức khoẻ"), href: "/health", icon: HeartPulse },
    { name: t("Knowledge", "Knowledge"), href: "/knowledge", icon: Database },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="c-topnav hidden md:flex" data-scrolled={scrolled}>
      <Link href="/" aria-label="Crucible" className="flex-none mr-2.5 no-underline hover:no-underline">
        <span className="c-logo-mark w-9 h-9">C</span>
      </Link>

      <nav className="flex items-center gap-0.5 flex-1">
        {navItems.map(({ name, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`c-topnav-item ${isActive(href) ? "active" : ""}`}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span>{name}</span>
          </Link>
        ))}
      </nav>

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
          className={`c-topnav-item ${isActive("/settings") ? "active" : ""}`}
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
