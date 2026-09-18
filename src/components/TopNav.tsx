"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, FileText, Database, GraduationCap, LayoutDashboard,
  Languages, Moon, Sun, Repeat,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Thanh điều hướng trên cùng (từ 768px trở lên).
 *
 * Thay cho `Sidebar` cột trái 248px của bản cũ. Design system đặt toàn bộ điều
 * hướng lên một thanh ngang: bỏ cột trái là trả lại 248px chiều ngang cho nội
 * dung, và tiêu đề trang mới có chỗ để đứng ở cỡ tuyên ngôn.
 *
 * Điện thoại vẫn dùng `MobileTopBar` + `MobileNav` — thanh này ẩn dưới 768px.
 *
 * Thanh cuộn ngang được (`.c-topnav` đặt `overflow-x: auto`): năm mục điều
 * hướng cộng ba nút điều khiển vừa khít ở 1280px, nhưng ở 1024px thì mục cuối
 * sẽ bị cắt nếu không cho cuộn.
 */
export default function TopNav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { name: t("Home", "Trang chủ"), href: "/", icon: LayoutDashboard },
    { name: t("Knowledge Hub", "Knowledge Hub"), href: "/knowledge", icon: Database },
    { name: t("Finance OS", "Sổ chi tiêu"), href: "/finance", icon: FileText },
    { name: t("Learning Hub", "Learning Hub"), href: "/learning", icon: GraduationCap },
    { name: t("Habits", "Thói quen"), href: "/habits", icon: Repeat },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="c-topnav hidden md:flex">
      <Link href="/" className="flex items-center gap-3 flex-none pr-6 no-underline hover:no-underline">
        {/* Không tô tím: tím chỉ dành cho hành động chính. Logo là một hạt
            kính với chữ Skywash, như wordmark của AuthKit. */}
        <span className="c-logo-mark w-8 h-8"><span>C</span></span>
        <span className="c-logo-word">Crucible</span>
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {navItems.map(({ name, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`c-topnav-item ${isActive(href) ? "active" : ""}`}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{name}</span>
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1 flex-none pl-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="c-topnav-item"
        >
          {theme === "dark" ? <Moon size={17} strokeWidth={1.8} /> : <Sun size={17} strokeWidth={1.8} />}
        </button>

        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="c-topnav-item"
        >
          <Languages size={17} strokeWidth={1.8} />
          <span className="uppercase text-xs tracking-wider">{language}</span>
        </button>

        <Link
          href="/settings"
          aria-label={t("Settings", "Cài đặt")}
          className={`c-topnav-item ${isActive("/settings") ? "active" : ""}`}
        >
          <Settings size={17} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
